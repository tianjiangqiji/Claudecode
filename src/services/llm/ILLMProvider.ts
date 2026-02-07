/**
 * ILLMProvider - LLM Provider 抽象接口
 *
 * 所有 Provider（Claude Code SDK, OpenAI, Anthropic, Gemini）均需实现此接口
 * 提供统一的查询、中断、模型管理能力
 */

import { createDecorator } from '../../di/instantiation';
import type {
    ProviderType,
    ProviderConfig,
    LLMStreamEvent,
    LLMQueryParams,
    ModelInfo,
} from './types';

export const ILLMProviderService = createDecorator<ILLMProviderService>('llmProviderService');

/**
 * LLM 查询句柄（类似 SDK 的 Query 对象）
 * 用于控制正在进行的查询
 */
export interface LLMQueryHandle extends AsyncIterable<LLMStreamEvent> {
    /** 中断查询 */
    interrupt(): Promise<void>;
    /** 设置模型（运行中切换） */
    setModel?(model: string): Promise<void>;
    /** 设置思考 tokens 上限 */
    setMaxThinkingTokens?(tokens: number): Promise<void>;
    /** 获取支持的模型列表 */
    supportedModels?(): Promise<ModelInfo[]>;
    /** 获取支持的命令列表 */
    supportedCommands?(): Promise<Array<{ name: string; description?: string }>>;
    /** 结束迭代 */
    return?(): Promise<IteratorResult<LLMStreamEvent>>;
}

/**
 * LLM Provider 服务接口
 *
 * 管理所有已注册的 Provider，根据配置路由到对应 Provider
 */
export interface ILLMProviderService {
    readonly _serviceBrand: undefined;

    /**
     * 获取当前活跃的 Provider 类型
     */
    getActiveProviderType(): ProviderType;

    /**
     * 获取当前 Provider 配置
     */
    getProviderConfig(): ProviderConfig;

    /**
     * 设置活跃 Provider
     */
    setActiveProvider(type: ProviderType): Promise<void>;

    /**
     * 更新 Provider 配置
     */
    updateProviderConfig(config: Partial<ProviderConfig>): Promise<void>;

    /**
     * 执行查询（路由到活跃 Provider）
     */
    query(params: LLMQueryParams): Promise<LLMQueryHandle>;

    /**
     * 获取当前 Provider 可用的模型列表
     */
    getAvailableModels(): ModelInfo[];

    /**
     * 获取所有 Provider 的模型列表
     */
    getAllModels(): Record<ProviderType, ModelInfo[]>;

    /**
     * 检查 Provider 是否就绪（API Key 已配置等）
     */
    isReady(): boolean;

    /**
     * 获取 Provider 状态信息
     */
    getStatus(): ProviderStatus;
}

/**
 * Provider 状态
 */
export interface ProviderStatus {
    type: ProviderType;
    ready: boolean;
    error?: string;
    hasApiKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    currentModel: string;
    customModels: Array<{ id: string; label: string; description?: string }>;
    extraHeaders: Record<string, string>;
}

/**
 * 单个 Provider 实现需要满足的接口
 */
export interface ILLMProviderBackend {
    readonly type: ProviderType;

    /**
     * 初始化 Provider
     */
    initialize(config: ProviderConfig): Promise<void>;

    /**
     * 执行查询
     */
    query(params: LLMQueryParams): Promise<LLMQueryHandle>;

    /**
     * 获取可用模型
     */
    getModels(): ModelInfo[];

    /**
     * 检查是否就绪
     */
    isReady(): boolean;

    /**
     * 销毁 Provider
     */
    dispose(): void;
}
