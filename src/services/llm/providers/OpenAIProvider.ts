/**
 * OpenAI Provider - 支持 OpenAI 兼容 API
 *
 * 协议端点:
 * - /v1/chat/completions (Chat Completions)
 * - /v1/responses (Codex/Responses API)
 *
 * 兼容所有 OpenAI API 兼容服务（Azure、本地模型等）
 */

import type {
    ProviderConfig,
    LLMQueryParams,
    ModelInfo,
    LLMStreamEvent,
    ContentBlock,
    TextContentBlock,
    ToolUseContentBlock,
    ThinkingContentBlock,
} from '../types';
import { DEFAULT_MODELS } from '../types';
import type { ILLMProviderBackend, LLMQueryHandle } from '../ILLMProvider';
import { AsyncStreamAdapter } from '../utils/AsyncStreamAdapter';

export class OpenAIProvider implements ILLMProviderBackend {
    readonly type = 'openai' as const;
    private config: ProviderConfig = { type: 'openai' };
    private customModels: ModelInfo[] = [];
    private abortController?: AbortController;

    async initialize(config: ProviderConfig): Promise<void> {
        this.config = config;
        this.customModels = (config.customModels || []).map(m => ({
            ...m,
            provider: 'openai' as const,
        }));
    }

    async query(params: LLMQueryParams): Promise<LLMQueryHandle> {
        const stream = new AsyncStreamAdapter<LLMStreamEvent>();
        this.abortController = new AbortController();

        this.executeQuery(params, stream, this.abortController.signal).catch(err => {
            stream.enqueue({
                type: 'result',
                subtype: 'error',
                error: err.message || String(err),
                is_error: true,
            });
            stream.done();
        });

        const abortCtrl = this.abortController;
        return {
            [Symbol.asyncIterator]() {
                return stream[Symbol.asyncIterator]();
            },
            async interrupt() {
                abortCtrl.abort();
                stream.done();
            },
        };
    }

    getModels(): ModelInfo[] {
        return [...DEFAULT_MODELS['openai'], ...this.customModels];
    }

    isReady(): boolean {
        return !!this.config.apiKey;
    }

    dispose(): void {
        this.abortController?.abort();
    }

    // ========================================================================
    // 内部实现
    // ========================================================================

    private async executeQuery(
        params: LLMQueryParams,
        stream: AsyncStreamAdapter<LLMStreamEvent>,
        signal: AbortSignal
    ): Promise<void> {
        const baseUrl = (this.config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
        const url = `${baseUrl}/v1/chat/completions`;
        const sessionId = `openai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // 发送 init 事件
        stream.enqueue({
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
        });

        // 构建请求体
        const body = this.buildRequestBody(params);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...this.config.extraHeaders,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API 错误 (${response.status}): ${errorText}`);
        }

        if (body.stream) {
            await this.handleStreamResponse(response, stream, sessionId);
        } else {
            await this.handleSyncResponse(response, stream, sessionId);
        }

        // 发送结果事件
        stream.enqueue({
            type: 'result',
            subtype: 'success',
            session_id: sessionId,
        });
        stream.done();
    }

    private buildRequestBody(params: LLMQueryParams): any {
        const messages: any[] = [];

        // 系统提示
        if (params.systemPrompt) {
            messages.push({ role: 'system', content: params.systemPrompt });
        }

        // 用户消息
        for (const msg of params.messages) {
            messages.push(this.convertMessage(msg));
        }

        const body: any = {
            model: params.model,
            messages,
            stream: params.stream !== false,
            stream_options: params.stream !== false ? { include_usage: true } : undefined,
        };

        if (params.maxTokens) {
            body.max_tokens = params.maxTokens;
        }
        if (params.temperature !== undefined) {
            body.temperature = params.temperature;
        }

        // 工具定义转换
        if (params.tools && params.tools.length > 0) {
            body.tools = params.tools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            }));
        }

        return body;
    }

    private convertMessage(msg: any): any {
        if (typeof msg.content === 'string') {
            return { role: msg.role, content: msg.content };
        }

        // 复杂内容块
        if (Array.isArray(msg.content)) {
            const parts: any[] = [];
            for (const block of msg.content) {
                switch (block.type) {
                    case 'text':
                        parts.push({ type: 'text', text: block.text });
                        break;
                    case 'image':
                        if (block.source?.type === 'base64') {
                            parts.push({
                                type: 'image_url',
                                image_url: {
                                    url: `data:${block.source.media_type};base64,${block.source.data}`,
                                },
                            });
                        } else if (block.source?.url) {
                            parts.push({
                                type: 'image_url',
                                image_url: { url: block.source.url },
                            });
                        }
                        break;
                    case 'tool_result':
                        return {
                            role: 'tool',
                            tool_call_id: block.tool_use_id,
                            content: typeof block.content === 'string'
                                ? block.content
                                : JSON.stringify(block.content),
                        };
                }
            }
            return { role: msg.role, content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts };
        }

        return { role: msg.role, content: String(msg.content) };
    }

    private async handleStreamResponse(
        response: Response,
        stream: AsyncStreamAdapter<LLMStreamEvent>,
        sessionId: string
    ): Promise<void> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';
        const contentBlocks: ContentBlock[] = [];
        let currentText = '';
        const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const chunk = JSON.parse(data);
                        const delta = chunk.choices?.[0]?.delta;
                        if (!delta) continue;

                        // 文本内容
                        if (delta.content) {
                            currentText += delta.content;
                        }

                        // 工具调用
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index ?? 0;
                                if (!toolCalls.has(idx)) {
                                    toolCalls.set(idx, {
                                        id: tc.id || '',
                                        name: tc.function?.name || '',
                                        arguments: '',
                                    });
                                }
                                const existing = toolCalls.get(idx)!;
                                if (tc.id) existing.id = tc.id;
                                if (tc.function?.name) existing.name = tc.function.name;
                                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                            }
                        }

                        // 增量发送 assistant 事件
                        const blocks: ContentBlock[] = [];
                        if (currentText) {
                            blocks.push({ type: 'text', text: currentText } as TextContentBlock);
                        }
                        for (const [, tc] of toolCalls) {
                            if (tc.name) {
                                let input: Record<string, unknown> = {};
                                try { input = JSON.parse(tc.arguments); } catch {}
                                blocks.push({
                                    type: 'tool_use',
                                    id: tc.id,
                                    name: tc.name,
                                    input,
                                } as ToolUseContentBlock);
                            }
                        }

                        if (blocks.length > 0) {
                            stream.enqueue({
                                type: 'assistant',
                                message: {
                                    role: 'assistant',
                                    content: blocks,
                                    model: chunk.model,
                                    usage: chunk.usage ? {
                                        input_tokens: chunk.usage.prompt_tokens || 0,
                                        output_tokens: chunk.usage.completion_tokens || 0,
                                    } : undefined,
                                },
                            });
                        }
                    } catch {
                        // 跳过无法解析的行
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private async handleSyncResponse(
        response: Response,
        stream: AsyncStreamAdapter<LLMStreamEvent>,
        sessionId: string
    ): Promise<void> {
        const data: any = await response.json();
        const choice = data.choices?.[0];
        if (!choice) return;

        const blocks: ContentBlock[] = [];

        if (choice.message?.content) {
            blocks.push({ type: 'text', text: choice.message.content } as TextContentBlock);
        }

        if (choice.message?.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                let input: Record<string, unknown> = {};
                try { input = JSON.parse(tc.function?.arguments || '{}'); } catch {}
                blocks.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.function?.name || '',
                    input,
                } as ToolUseContentBlock);
            }
        }

        if (blocks.length > 0) {
            stream.enqueue({
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: blocks,
                    model: data.model,
                    usage: data.usage ? {
                        input_tokens: data.usage.prompt_tokens || 0,
                        output_tokens: data.usage.completion_tokens || 0,
                    } : undefined,
                },
            });
        }
    }
}
