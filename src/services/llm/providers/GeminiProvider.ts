/**
 * Gemini Provider - Google Gemini API
 *
 * 协议端点: /v1beta/models/{model}:streamGenerateContent
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
} from '../types';
import { DEFAULT_MODELS } from '../types';
import type { ILLMProviderBackend, LLMQueryHandle } from '../ILLMProvider';
import { AsyncStreamAdapter } from '../utils/AsyncStreamAdapter';

export class GeminiProvider implements ILLMProviderBackend {
    readonly type = 'gemini' as const;
    private config: ProviderConfig = { type: 'gemini' };
    private customModels: ModelInfo[] = [];
    private abortController?: AbortController;

    async initialize(config: ProviderConfig): Promise<void> {
        this.config = config;
        this.customModels = (config.customModels || []).map(m => ({
            ...m,
            provider: 'gemini' as const,
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
        return [...DEFAULT_MODELS['gemini'], ...this.customModels];
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
        const baseUrl = (this.config.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        const useStream = params.stream !== false;
        const method = useStream ? 'streamGenerateContent' : 'generateContent';
        const url = `${baseUrl}/v1beta/models/${params.model}:${method}?key=${this.config.apiKey}${useStream ? '&alt=sse' : ''}`;
        const sessionId = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        stream.enqueue({
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
        });

        const body = this.buildRequestBody(params);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
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
            throw new Error(`Gemini API 错误 (${response.status}): ${errorText}`);
        }

        if (useStream) {
            await this.handleStreamResponse(response, stream, sessionId, params.model);
        } else {
            await this.handleSyncResponse(response, stream, sessionId, params.model);
        }

        stream.enqueue({
            type: 'result',
            subtype: 'success',
            session_id: sessionId,
        });
        stream.done();
    }

    private buildRequestBody(params: LLMQueryParams): any {
        const contents: any[] = [];

        for (const msg of params.messages) {
            if (msg.role === 'system') continue;
            contents.push(this.convertMessage(msg));
        }

        const body: any = {
            contents,
            generationConfig: {} as any,
        };

        // 系统指令
        const systemMsg = params.messages.find(m => m.role === 'system');
        const systemText = systemMsg
            ? (typeof systemMsg.content === 'string' ? systemMsg.content : '')
            : params.systemPrompt;
        if (systemText) {
            body.systemInstruction = {
                parts: [{ text: systemText }],
            };
        }

        if (params.maxTokens) {
            body.generationConfig.maxOutputTokens = params.maxTokens;
        }
        if (params.temperature !== undefined) {
            body.generationConfig.temperature = params.temperature;
        }

        // 思考模式
        if (params.maxThinkingTokens && params.maxThinkingTokens > 0) {
            body.generationConfig.thinkingConfig = {
                thinkingBudget: params.maxThinkingTokens,
            };
        }

        // 工具定义
        if (params.tools && params.tools.length > 0) {
            body.tools = [{
                functionDeclarations: params.tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                })),
            }];
        }

        return body;
    }

    private convertMessage(msg: any): any {
        // Gemini 使用 user/model 角色
        const role = msg.role === 'assistant' ? 'model' : 'user';

        if (typeof msg.content === 'string') {
            return {
                role,
                parts: [{ text: msg.content }],
            };
        }

        if (Array.isArray(msg.content)) {
            const parts: any[] = [];
            for (const block of msg.content) {
                switch (block.type) {
                    case 'text':
                        parts.push({ text: block.text });
                        break;
                    case 'image':
                        if (block.source?.type === 'base64') {
                            parts.push({
                                inlineData: {
                                    mimeType: block.source.media_type || 'image/png',
                                    data: block.source.data,
                                },
                            });
                        }
                        break;
                    case 'tool_use':
                        parts.push({
                            functionCall: {
                                name: block.name,
                                args: block.input,
                            },
                        });
                        break;
                    case 'tool_result':
                        parts.push({
                            functionResponse: {
                                name: block.tool_use_id,
                                response: {
                                    result: typeof block.content === 'string'
                                        ? block.content
                                        : JSON.stringify(block.content),
                                },
                            },
                        });
                        break;
                }
            }
            return { role, parts };
        }

        return { role, parts: [{ text: String(msg.content) }] };
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

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (!data) continue;

                    try {
                        const chunk = JSON.parse(data);
                        const candidates = chunk.candidates;
                        if (!candidates || candidates.length === 0) continue;

                        const candidate = candidates[0];
                        const content = candidate.content;
                        if (!content?.parts) continue;

                        const blocks = this.partsToContentBlocks(content.parts);
                        if (blocks.length > 0) {
                            stream.enqueue({
                                type: 'assistant',
                                message: {
                                    role: 'assistant',
                                    content: blocks,
                                    model: modelId,
                                    usage: chunk.usageMetadata ? {
                                        input_tokens: chunk.usageMetadata.promptTokenCount || 0,
                                        output_tokens: chunk.usageMetadata.candidatesTokenCount || 0,
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
        sessionId: string,
        modelId: string
    ): Promise<void> {
        const data: any = await response.json();
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) return;

        const candidate = candidates[0];
        const content = candidate.content;
        if (!content?.parts) return;

        const blocks = this.partsToContentBlocks(content.parts);
        if (blocks.length > 0) {
            stream.enqueue({
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: blocks,
                    model: modelId,
                    usage: data.usageMetadata ? {
                        input_tokens: data.usageMetadata.promptTokenCount || 0,
                        output_tokens: data.usageMetadata.candidatesTokenCount || 0,
                    } : undefined,
                },
            });
        }
    }

    private partsToContentBlocks(parts: any[]): ContentBlock[] {
        const blocks: ContentBlock[] = [];

        for (const part of parts) {
            if (part.text !== undefined) {
                blocks.push({ type: 'text', text: part.text } as TextContentBlock);
            }
            if (part.thought !== undefined) {
                blocks.push({ type: 'thinking', thinking: part.thought } as any);
            }
            if (part.functionCall) {
                blocks.push({
                    type: 'tool_use',
                    id: `gemini-tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: part.functionCall.name,
                    input: part.functionCall.args || {},
                } as ToolUseContentBlock);
            }
        }

        return blocks;
    }
}
