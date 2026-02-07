/**
 * ClaudeCodeProvider - Claude Code SDK 包装器
 *
 * 将现有的 ClaudeSdkService 适配为 ILLMProviderBackend 接口
 * 保持原有 Claude Agent SDK 的完整功能（工具调用、权限管理、会话恢复等）
 */

import type {
    ProviderConfig,
    LLMQueryParams,
    ModelInfo,
    LLMStreamEvent,
} from '../types';
import { DEFAULT_MODELS } from '../types';
import type { ILLMProviderBackend, LLMQueryHandle } from '../ILLMProvider';

/**
 * Claude Code Provider 只是一个占位标记
 *
 * 当 Provider 类型为 'claude-code' 时，ClaudeAgentService 会使用
 * 原有的 ClaudeSdkService 流程，不经过 LLMProviderService 的 query()
 */
export class ClaudeCodeProvider implements ILLMProviderBackend {
    readonly type = 'claude-code' as const;
    private customModels: ModelInfo[] = [];

    async initialize(config: ProviderConfig): Promise<void> {
        this.customModels = (config.customModels || []).map(m => ({
            ...m,
            provider: 'claude-code' as const,
        }));
    }

    async query(_params: LLMQueryParams): Promise<LLMQueryHandle> {
        // Claude Code 模式不通过此接口查询
        // 实际查询由 ClaudeSdkService 处理
        throw new Error(
            'ClaudeCodeProvider.query() 不应被直接调用。' +
            'Claude Code 模式使用原生 SDK 流程，由 ClaudeAgentService 直接调用 ClaudeSdkService。'
        );
    }

    getModels(): ModelInfo[] {
        return [...DEFAULT_MODELS['claude-code'], ...this.customModels];
    }

    isReady(): boolean {
        // Claude Code SDK 通过 CLI 二进制文件工作，不需要 API Key
        return true;
    }

    dispose(): void {
        // no-op
    }
}
