/**
 * Anthropic Provider - 直接调用 Anthropic Messages API
 *
 * 协议端点: /v1/messages
 * 支持流式输出和工具调用
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

export class AnthropicProvider implements ILLMProviderBackend {
    readonly type = 'anthropic' as const;
    private config: ProviderConfig = { type: 'anthropic' };
    private customModels: ModelInfo[] = [];
    private abortController?: AbortController;

    async initialize(config: ProviderConfig): Promise<void> {
        this.config = config;
        this.customModels = (config.customModels || []).map(m => ({
            ...m,
            provider: 'anthropic' as const,
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
        return [...DEFAULT_MODELS['anthropic'], ...this.customModels];
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
        const baseUrl = (this.config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
        const url = `${baseUrl}/v1/messages`;
        const sessionId = `anthropic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        stream.enqueue({
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
        });

        const body = this.buildRequestBody(params);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey || '',
            'anthropic-version': '2023-06-01',
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
            throw new Error(`Anthropic API 错误 (${response.status}): ${errorText}`);
        }

        if (body.stream) {
            await this.handleStreamResponse(response, stream, sessionId, params.model);
        } else {
            await this.handleSyncResponse(response, stream, sessionId);
        }

        stream.enqueue({
            type: 'result',
            subtype: 'success',
            session_id: sessionId,
        });
        stream.done();
    }

    private buildRequestBody(params: LLMQueryParams): any {
        const messages: any[] = [];

        for (const msg of params.messages) {
            if (msg.role === 'system') continue; // system 走单独字段
            messages.push(this.convertMessage(msg));
        }

        const body: any = {
            model: params.model,
            messages,
            max_tokens: params.maxTokens || 8192,
            stream: params.stream !== false,
        };

        // 系统提示
        const systemMsg = params.messages.find(m => m.role === 'system');
        const systemText = systemMsg
            ? (typeof systemMsg.content === 'string' ? systemMsg.content : '')
            : params.systemPrompt;
        if (systemText) {
            body.system = systemText;
        }

        if (params.temperature !== undefined) {
            body.temperature = params.temperature;
        }

        // 扩展思考
        if (params.maxThinkingTokens && params.maxThinkingTokens > 0) {
            body.thinking = {
                type: 'enabled',
                budget_tokens: params.maxThinkingTokens,
            };
        }

        // 工具定义（Anthropic 格式）
        if (params.tools && params.tools.length > 0) {
            body.tools = params.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
            }));
        }

        return body;
    }

    private convertMessage(msg: any): any {
        if (typeof msg.content === 'string') {
            return { role: msg.role, content: msg.content };
        }

        if (Array.isArray(msg.content)) {
            const content: any[] = [];
            for (const block of msg.content) {
                switch (block.type) {
                    case 'text':
                        content.push({ type: 'text', text: block.text });
                        break;
                    case 'image':
                        content.push({
                            type: 'image',
                            source: block.source,
                        });
                        break;
                    case 'tool_use':
                        content.push({
                            type: 'tool_use',
                            id: block.id,
                            name: block.name,
                            input: block.input,
                        });
                        break;
                    case 'tool_result':
                        content.push({
                            type: 'tool_result',
                            tool_use_id: block.tool_use_id,
                            content: block.content,
                            is_error: block.is_error,
                        });
                        break;
                    case 'thinking':
                        content.push({
                            type: 'thinking',
                            thinking: block.thinking,
                        });
                        break;
                }
            }
            return { role: msg.role, content };
        }

        return { role: msg.role, content: String(msg.content) };
    }

    private async handleStreamResponse(
        response: Response,
        stream: AsyncStreamAdapter<LLMStreamEvent>,
        sessionId: string,
        modelId: string
    ): Promise<void> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';
        const contentBlocks: ContentBlock[] = [];
        let currentBlockIndex = -1;
        let currentText = '';
        let currentToolId = '';
        let currentToolName = '';
        let currentToolArgs = '';
        let currentThinking = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = '';
                for (const line of lines) {
                    const trimmed = line.trim();

                    if (trimmed.startsWith('event: ')) {
                        eventType = trimmed.slice(7);
                        continue;
                    }

                    if (!trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (!data) continue;

                    try {
                        const chunk = JSON.parse(data);

                        switch (eventType) {
                            case 'content_block_start': {
                                currentBlockIndex = chunk.index ?? (currentBlockIndex + 1);
                                const block = chunk.content_block;
                                if (block?.type === 'text') {
                                    currentText = block.text || '';
                                } else if (block?.type === 'tool_use') {
                                    currentToolId = block.id || '';
                                    currentToolName = block.name || '';
                                    currentToolArgs = '';
                                } else if (block?.type === 'thinking') {
                                    currentThinking = block.thinking || '';
                                }
                                break;
                            }
                            case 'content_block_delta': {
                                const delta = chunk.delta;
                                if (delta?.type === 'text_delta') {
                                    currentText += delta.text || '';
                                } else if (delta?.type === 'input_json_delta') {
                                    currentToolArgs += delta.partial_json || '';
                                } else if (delta?.type === 'thinking_delta') {
                                    currentThinking += delta.thinking || '';
                                }
                                break;
                            }
                            case 'content_block_stop': {
                                // 构建完整块并发送
                                const blocks: ContentBlock[] = [];
                                if (currentText) {
                                    blocks.push({ type: 'text', text: currentText } as TextContentBlock);
                                }
                                if (currentThinking) {
                                    blocks.push({ type: 'thinking', thinking: currentThinking } as ThinkingContentBlock);
                                }
                                if (currentToolName) {
                                    let input: Record<string, unknown> = {};
                                    try { input = JSON.parse(currentToolArgs); } catch {}
                                    blocks.push({
                                        type: 'tool_use',
                                        id: currentToolId,
                                        name: currentToolName,
                                        input,
                                    } as ToolUseContentBlock);
                                }
                                if (blocks.length > 0) {
                                    stream.enqueue({
                                        type: 'assistant',
                                        message: {
                                            role: 'assistant',
                                            content: blocks,
                                            model: modelId,
                                        },
                                    });
                                }
                                // 重置
                                currentText = '';
                                currentToolId = '';
                                currentToolName = '';
                                currentToolArgs = '';
                                currentThinking = '';
                                break;
                            }
                            case 'message_delta': {
                                // usage 信息
                                if (chunk.usage) {
                                    stream.enqueue({
                                        type: 'assistant',
                                        message: {
                                            role: 'assistant',
                                            content: [],
                                            model: modelId,
                                            usage: {
                                                input_tokens: chunk.usage.input_tokens || 0,
                                                output_tokens: chunk.usage.output_tokens || 0,
                                            },
                                            stop_reason: chunk.delta?.stop_reason,
                                        },
                                    });
                                }
                                break;
                            }
                            case 'message_start': {
                                if (chunk.message?.usage) {
                                    stream.enqueue({
                                        type: 'assistant',
                                        message: {
                                            role: 'assistant',
                                            content: [],
                                            model: chunk.message.model || modelId,
                                            usage: {
                                                input_tokens: chunk.message.usage.input_tokens || 0,
                                                output_tokens: chunk.message.usage.output_tokens || 0,
                                                cache_creation_input_tokens: chunk.message.usage.cache_creation_input_tokens,
                                                cache_read_input_tokens: chunk.message.usage.cache_read_input_tokens,
                                            },
                                        },
                                    });
                                }
                                break;
                            }
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
        const blocks: ContentBlock[] = [];

        if (data.content && Array.isArray(data.content)) {
            for (const block of data.content) {
                switch (block.type) {
                    case 'text':
                        blocks.push({ type: 'text', text: block.text } as TextContentBlock);
                        break;
                    case 'tool_use':
                        blocks.push({
                            type: 'tool_use',
                            id: block.id,
                            name: block.name,
                            input: block.input,
                        } as ToolUseContentBlock);
                        break;
                    case 'thinking':
                        blocks.push({ type: 'thinking', thinking: block.thinking } as ThinkingContentBlock);
                        break;
                }
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
                        input_tokens: data.usage.input_tokens || 0,
                        output_tokens: data.usage.output_tokens || 0,
                        cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
                        cache_read_input_tokens: data.usage.cache_read_input_tokens,
                    } : undefined,
                    stop_reason: data.stop_reason,
                },
            });
        }
    }
}
