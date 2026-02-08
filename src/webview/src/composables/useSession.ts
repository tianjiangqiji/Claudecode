/**
 * useSession - Vue Composable for Session
 *
 * 核心功能：
 * 1. 将 Session 类的 alien-signals 转换为 Vue refs
 * 2. 将 alien computed 转换为 Vue computed
 * 3. 提供 Vue-friendly 的 API
 *
 * 使用方法：
 * ```typescript
 * const session = new Session(...);
 * const sessionAPI = useSession(session);
 * // sessionAPI.messages 是 Vue Ref<any[]>
 * // sessionAPI.busy 是 Vue Ref<boolean>
 * ```
 */

import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useSignal } from '@gn8/alien-signals-vue';
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { Session, SelectionRange, StateSyncMeta } from '../core/Session';
import type { PermissionRequest } from '../core/PermissionRequest';
import type { BaseTransport } from '../transport/BaseTransport';
import type { ModelOption } from '../../../shared/messages';

/**
 * useSession 返回类型
 */
export interface UseSessionReturn {
  // 基础状态
  connection: Ref<BaseTransport | undefined>;
  busy: Ref<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<string | undefined>;
  sessionId: Ref<string | undefined>;
  isExplicit: Ref<boolean>;
  lastModifiedTime: Ref<number>;

  // 核心数据
  messages: Ref<any[]>;
  messageCount: Ref<number>;
  cwd: Ref<string | undefined>;
  permissionMode: Ref<PermissionMode>;
  summary: Ref<string | undefined>;
  modelSelection: Ref<string | undefined>;
  thinkingLevel: Ref<string>;
  todos: Ref<any[]>;
  worktree: Ref<{ name: string; path: string } | undefined>;
  selection: Ref<SelectionRange | undefined>;

  // 使用统计
  usageData: Ref<{
    totalTokens: number;
    totalCost: number;
    contextWindow: number;
  }>;
  stateSyncMeta: Ref<StateSyncMeta | null>;

  // 计算属性
  claudeConfig: ComputedRef<any>;
  config: ComputedRef<any>;
  permissionRequests: ComputedRef<PermissionRequest[]>;

  // 派生状态
  isOffline: ComputedRef<boolean>;

  // 方法
  getConnection: () => Promise<BaseTransport>;
  preloadConnection: () => Promise<void>;
  loadFromServer: () => Promise<void>;
  send: (
    input: string,
    attachments?: Array<{ fileName: string; mediaType: string; data: string }>,
    includeSelection?: boolean
  ) => Promise<void>;
  launchClaude: () => Promise<string>;
  interrupt: () => Promise<void>;
  restartClaude: () => Promise<void>;
  listFiles: (pattern?: string) => Promise<any>;
  setPermissionMode: (mode: PermissionMode, applyToConnection?: boolean, source?: string) => Promise<boolean>;
  setModel: (model: ModelOption, source?: string) => Promise<boolean>;
  setThinkingLevel: (level: string) => Promise<void>;
  rollbackToMessage: (message: any, options?: { rewindFiles?: boolean }) => Promise<boolean>;
  getMcpServers: () => Promise<any>;
  openConfigFile: (configType: string) => Promise<void>;
  showMessage: (level: 'info' | 'warning' | 'error', message: string, items?: string[], modal?: boolean) => Promise<string | undefined>;
  onPermissionRequested: (callback: (request: PermissionRequest) => void) => () => void;
  dispose: () => void;

  // 原始实例（用于高级场景）
  __session: Session;
}

/**
 * useSession - 将 Session 实例包装为 Vue Composable API
 *
 * @param session Session 实例
 * @returns Vue-friendly API
 */
export function useSession(session: Session): UseSessionReturn {
  //  使用官方 useSignal 桥接 signals/computed
  const connection = useSignal(session.connection);
  const busy = useSignal(session.busy);
  const isLoading = useSignal(session.isLoading);
  const error = useSignal(session.error);
  const sessionId = useSignal(session.sessionId);
  const isExplicit = useSignal(session.isExplicit);
  const lastModifiedTime = useSignal(session.lastModifiedTime);
  const messages = useSignal(session.messages);
  const messageCount = useSignal(session.messageCount);
  const cwd = useSignal(session.cwd);
  const permissionMode = useSignal(session.permissionMode);
  const summary = useSignal(session.summary);
  const modelSelection = useSignal(session.modelSelection);
  const thinkingLevel = useSignal(session.thinkingLevel);
  const todos = useSignal(session.todos);
  const worktree = useSignal(session.worktree);
  const selection = useSignal(session.selection);
  const usageData = useSignal(session.usageData);
  const stateSyncMeta = useSignal(session.stateSyncMeta);

  //  使用 useSignal 包装 alien computed（读-only 使用，不调用 setter）
  const claudeConfig = useSignal(session.claudeConfig as any);
  const config = useSignal(session.config as any);
  const permissionRequests = useSignal(session.permissionRequests) as unknown as ComputedRef<PermissionRequest[]>;

  //  派生状态（临时保留 Vue computed）
  const isOffline = computed(() => session.isOffline());

  //  绑定所有方法（确保 this 指向正确）
  const getConnection = session.getConnection.bind(session);
  const preloadConnection = session.preloadConnection.bind(session);
  const loadFromServer = session.loadFromServer.bind(session);
  const send = session.send.bind(session);
  const launchClaude = session.launchClaude.bind(session);
  const interrupt = session.interrupt.bind(session);
  const restartClaude = session.restartClaude.bind(session);
  const listFiles = session.listFiles.bind(session);
  const setPermissionMode = session.setPermissionMode.bind(session);
  const setModel = session.setModel.bind(session);
  const setThinkingLevel = session.setThinkingLevel.bind(session);
  const rollbackToMessage = session.rollbackToMessage.bind(session);
  const getMcpServers = session.getMcpServers.bind(session);
  const openConfigFile = session.openConfigFile.bind(session);
  const showMessage = session.showMessage.bind(session);
  const onPermissionRequested = session.onPermissionRequested.bind(session);
  const dispose = session.dispose.bind(session);

  return {
    // 状态
    connection,
    busy,
    isLoading,
    error,
    sessionId,
    isExplicit,
    lastModifiedTime,
    messages,
    messageCount,
    cwd,
    permissionMode,
    summary,
    modelSelection,
    thinkingLevel,
    todos,
    worktree,
    selection,
    usageData,
    stateSyncMeta,

    // 计算属性
    claudeConfig,
    config,
    permissionRequests,
    isOffline,

    // 方法
    getConnection,
    preloadConnection,
    loadFromServer,
    send,
    launchClaude,
    interrupt,
    restartClaude,
    listFiles,
    setPermissionMode,
    setModel,
    setThinkingLevel,
    rollbackToMessage,
    getMcpServers,
    openConfigFile,
    showMessage,
    onPermissionRequested,
    dispose,

    // 原始实例
    __session: session,
  };
}
