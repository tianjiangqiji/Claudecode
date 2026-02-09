import { signal, computed, effect } from 'alien-signals';
import type { BaseTransport } from '../transport/BaseTransport';
import type { PermissionRequest } from './PermissionRequest';
import type { ModelOption } from '../../../shared/messages';
import type { SessionSummary } from './types';
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import { processAndAttachMessage /*, mergeConsecutiveReadMessages */ } from '../utils/messageUtils';
import { Message as MessageModel } from '../models/Message';
import type { Message } from '../models/Message';

export interface SelectionRange {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  selectedText?: string;
}

export interface UsageData {
  totalTokens: number;
  totalCost: number;
  contextWindow: number;
}

export interface StateSyncMeta {
  kind: 'permissionMode' | 'modelSelection';
  source?: string;
  startedAt: number;
}

export interface AttachmentPayload {
  fileName: string;
  mediaType: string;
  data: string;
  fileSize?: number;
}

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export interface SessionOptions {
  isExplicit?: boolean;
  existingWorktree?: { name: string; path: string };
  resumeId?: string;
}

export interface SessionContext {
  currentSelection: ReturnType<typeof signal<SelectionRange | undefined>>;
  commandRegistry: { registerAction: (...args: any[]) => void };
  fileOpener: {
    open: (filePath: string, location?: any) => Promise<void> | void;
    openContent: (
      content: string,
      fileName: string,
      editable: boolean
    ) => Promise<string | undefined>;
  };
  showNotification?: (
    message: string,
    severity: 'info' | 'warning' | 'error',
    buttons?: string[],
    onlyIfNotVisible?: boolean
  ) => Promise<string | undefined>;
  startNewConversationTab?: (initialPrompt?: string) => boolean;
  renameTab?: (title: string) => boolean;
  openURL?: (url: string) => void;
}

interface SessionSnapshot {
  permissionMode: PermissionMode;
  modelSelection?: string;
  thinkingLevel: string;
  timestamp: number;
}

export class Session {
  private readonly claudeChannelId = signal<string | undefined>(undefined);
  private currentConnectionPromise?: Promise<BaseTransport>;
  private lastSentSelection?: SelectionRange;
  private effectCleanup?: () => void;
  private readonly historyLimit = 10;
  private history: SessionSnapshot[] = [];
  private redoStack: SessionSnapshot[] = [];

  readonly connection = signal<BaseTransport | undefined>(undefined);

  readonly busy = signal(false);
  readonly isLoading = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly sessionId = signal<string | undefined>(undefined);
  readonly isExplicit = signal(false);
  readonly lastModifiedTime = signal<number>(Date.now());
  readonly messages = signal<Message[]>([]);
  readonly messageCount = signal<number>(0);
  readonly cwd = signal<string | undefined>(undefined);
  readonly permissionMode = signal<PermissionMode>('acceptEdits');
  readonly summary = signal<string | undefined>(undefined);
  readonly modelSelection = signal<string | undefined>(undefined);
  readonly thinkingLevel = signal<string>('default_on');
  readonly stateSyncMeta = signal<StateSyncMeta | null>(null);
  readonly todos = signal<any[]>([]);
  readonly worktree = signal<{ name: string; path: string } | undefined>(undefined);
  readonly selection = signal<SelectionRange | undefined>(undefined);
  readonly usageData = signal<UsageData>({
    totalTokens: 0,
    totalCost: 0,
    contextWindow: 200000
  });

  readonly claudeConfig = computed(() => {
    const conn = this.connection();
    return conn?.claudeConfig?.();
  });

  readonly config = computed(() => {
    const conn = this.connection();
    return conn?.config?.();
  });

  readonly permissionRequests = computed<PermissionRequest[]>(() => {
    const conn = this.connection();
    const channelId = this.claudeChannelId();
    if (!conn || !channelId) {
      return [];
    }

    return conn
      .permissionRequests()
      .filter((request) => request.channelId === channelId);
  });

  isOffline(): boolean {
    return (
      !this.connection() &&
      !!this.sessionId() &&
      this.messages().length === 0 &&
      !this.currentConnectionPromise
    );
  }

  constructor(
    private readonly connectionProvider: () => Promise<BaseTransport>,
    private readonly context: SessionContext,
    options: SessionOptions = {}
  ) {
    this.isExplicit(options.isExplicit ?? true);

    effect(() => {
      this.selection(this.context.currentSelection());
    });
  }

  static fromServer(
    summary: SessionSummary,
    connectionProvider: () => Promise<BaseTransport>,
    context: SessionContext
  ): Session {
    const session = new Session(connectionProvider, context, { isExplicit: true });
    session.sessionId(summary.id);
    session.lastModifiedTime(summary.lastModified);
    session.summary(summary.summary);
    session.worktree(summary.worktree);
    session.messageCount(summary.messageCount ?? 0);  // 保存服务器返回的消息数量
    return session;
  }

  async getConnection(): Promise<BaseTransport> {
    const current = this.connection();
    if (current) {
      return current;
    }
    if (this.currentConnectionPromise) {
      return this.currentConnectionPromise;
    }

    this.currentConnectionPromise = this.connectionProvider().then((conn) => {
      this.connection(conn);
      return conn;
    });

    return this.currentConnectionPromise;
  }

  async preloadConnection(): Promise<void> {
    await this.getConnection();
    await this.launchClaude();
  }

  async loadFromServer(): Promise<void> {
    const sessionId = this.sessionId();
    if (!sessionId) {return;}

    this.isLoading(true);
    try {
      const connection = await this.getConnection();
      const response = await connection.getSession(sessionId);
      const accumulator: Message[] = [];
      for (const raw of response?.messages ?? []) {
        this.processMessage(raw);
        // 使用 processAndAttachMessage 来绑定 tool_result
        // 这样历史消息中的 tool_result 也会正确绑定到 tool_use
        processAndAttachMessage(accumulator, raw);
      }
      // 移除 ReadCoalesced 合并逻辑
      // this.messages(mergeConsecutiveReadMessages(accumulator));
      this.messages(accumulator);
      await this.launchClaude();
    } finally {
      this.isLoading(false);
    }
  }

  async send(
    input: string,
    attachments: AttachmentPayload[] = [],
    includeSelection = false
  ): Promise<void> {
    const connection = await this.getConnection();

    // 官方路线：不在 slash 命令时临时切换 thinkingLevel，保持会话一致性，
    // 由 SDK/服务端在 assistant 消息中提供 thinking/redacted_thinking 块以满足约束
    const isSlash = this.isSlashCommand(input);

    // 启动 channel（确保已带上当前 thinkingLevel）
    await this.launchClaude();

    // 追加规则已在 SDK systemPrompt.append 中注入，不再追加到用户消息
    const finalInput = input;

    const shouldIncludeSelection = includeSelection && !isSlash;
    let selectionPayload: SelectionRange | undefined;

    if (shouldIncludeSelection && !this.isSameSelection(this.lastSentSelection, this.selection())) {
      selectionPayload = this.selection();
      this.lastSentSelection = selectionPayload;
    }

    const userMessage = this.buildUserMessage(finalInput, attachments, selectionPayload);
    const messageModel = MessageModel.fromRaw(userMessage);

    if (messageModel) {
      this.messages([...this.messages(), messageModel]);
    }

    if (!this.summary()) {
      this.summary(input);
    }
    this.isExplicit(false);
    this.lastModifiedTime(Date.now());
    this.busy(true);

    try {
      const channelId = this.claudeChannelId();
      if (!channelId) {throw new Error('No active channel');}
      connection.sendInput(channelId, userMessage, false);
    } catch (error) {
      this.busy(false);
      throw error;
    }
  }

  async launchClaude(): Promise<string> {
    const existingChannel = this.claudeChannelId();
    if (existingChannel) {
      return existingChannel;
    }

    this.error(undefined);
    const channelId = Math.random().toString(36).slice(2);
    this.claudeChannelId(channelId);

    const connection = await this.getConnection();

    if (!this.cwd()) {
      this.cwd(connection.config()?.defaultCwd);
    }

    if (!this.modelSelection()) {
      this.modelSelection(connection.config()?.modelSetting);
    }

    if (!this.thinkingLevel()) {
      this.thinkingLevel(connection.config()?.thinkingLevel || 'default_on');
    }

    const stream = connection.launchClaude(
      channelId,
      this.sessionId() ?? undefined,
      this.cwd() ?? undefined,
      this.modelSelection() ?? undefined,
      this.permissionMode(),
      this.thinkingLevel()
    );

    void this.readMessages(stream);
    return channelId;
  }

  async interrupt(): Promise<void> {
    const channelId = this.claudeChannelId();
    if (!channelId) {
      return;
    }
    const connection = await this.getConnection();
    connection.interruptClaude(channelId);
  }

  async restartClaude(): Promise<void> {
    await this.interrupt();
    this.claudeChannelId(undefined);
    this.busy(false);
    await this.launchClaude();
  }

  async listFiles(pattern?: string, signal?: AbortSignal): Promise<any> {
    const connection = await this.getConnection();
    return connection.listFiles(pattern, signal);
  }

  async setPermissionMode(
    mode: PermissionMode,
    applyToConnection = true,
    source?: string
  ): Promise<boolean> {
    const previous = this.permissionMode();
    if (mode === previous) {
      return true;
    }
    const snapshot = this.recordSnapshot('permissionMode');
    this.stateSyncMeta({ kind: 'permissionMode', source, startedAt: performance.now() });
    this.permissionMode(mode);

    const channelId = this.claudeChannelId();
    if (!channelId || !applyToConnection) {
      return true;
    }
    const connection = await this.getConnection();
    const success = await connection.setPermissionMode(channelId, mode);
    if (!success) {
      this.permissionMode(previous);
      this.discardSnapshot(snapshot);
    }
    return success;
  }

  async setModel(model: ModelOption, source?: string): Promise<boolean> {
    const previous = this.modelSelection();
    if (model.value === previous) {
      return true;
    }
    const snapshot = this.recordSnapshot('modelSelection');
    this.stateSyncMeta({ kind: 'modelSelection', source, startedAt: performance.now() });
    this.modelSelection(model.value);

    const channelId = this.claudeChannelId();
    if (!channelId) {
      return true;
    }

    const connection = await this.getConnection();
    const response = await connection.setModel(channelId, model);

    if (!response?.success) {
      this.modelSelection(previous);
      this.discardSnapshot(snapshot);
      return false;
    }

    return true;
  }

  async setThinkingLevel(level: string): Promise<void> {
    this.thinkingLevel(level);

    const channelId = this.claudeChannelId();
    if (!channelId) {
      return;
    }

    const connection = await this.getConnection();
    await connection.setThinkingLevel(channelId, level);
  }

  async getMcpServers(): Promise<any> {
    const connection = await this.getConnection();
    const channelId = await this.launchClaude();
    return connection.getMcpServers(channelId);
  }

  async openConfigFile(configType: string): Promise<void> {
    const connection = await this.getConnection();
    await connection.openConfigFile(configType);
  }

  async undoLastChange(): Promise<boolean> {
    const target = this.history.pop();
    if (!target) {
      await this.context.showNotification?.('没有可撤销的操作', 'error');
      return false;
    }
    const current = this.captureSnapshot();
    const applied = await this.applySnapshot(target, current);
    if (!applied) {
      this.history.push(target);
      return false;
    }
    this.redoStack.push(current);
    if (this.redoStack.length > this.historyLimit) {
      this.redoStack.shift();
    }
    return true;
  }

  async showMessage(level: 'info' | 'warning' | 'error', message: string, items?: string[], modal?: boolean): Promise<string | undefined> {
    const connection = this.connection();
    if (!connection) {
      return undefined;
    }
    const result = await (connection as any).request({
        type: 'show_message',
        level,
        message,
        items,
        modal
    });
    return result.selected;
  }

  async rollbackToMessage(message: Message, options?: { rewindFiles?: boolean, deleteHistory?: boolean }): Promise<boolean> {
    const messages = this.messages();
    const index = messages.indexOf(message);
    if (index === -1) {
      return false;
    }

    // 如果正在生成，先中断
    if (this.busy()) {
      await this.interrupt();
    }

    const messageId = (message as any).uuid;
    const channelId = this.claudeChannelId();
    const conn = this.connection();

    // 1. 处理文件回滚
    if (options?.rewindFiles && messageId && channelId && conn) {
      try {
        console.log('[rollbackToMessage] Sending rewind_files request...', messageId);
        const result = await (conn as any).request({
          type: 'rewind_files',
          channelId: channelId,
          messageId: messageId
        });
        if (!result.success) {
          console.error('File rewind failed:', result.error);
          await this.context.showNotification?.(`文件回滚失败: ${result.error || '未知错误'}`, 'error');
        }
      } catch (e) {
        console.error('File rewind error:', e);
      }
    }

    // 2. 处理物理截断历史记录 (Task 6)
    if (options?.deleteHistory && messageId && channelId && conn) {
      try {
        console.log('[rollbackToMessage] Sending truncate_history request...', messageId);
        const result = await (conn as any).request({ 
          type: 'truncate_history',
          channelId: channelId,
          messageId: messageId
        });
        if (!result.success) {
          console.warn('History truncation failed:', result.error);
        }
      } catch (e) {
        console.error('History truncation error:', e);
      }
    }

    // 3. UI 层面删除该消息之后的所有消息 (保留当前消息)
    const newMessages = messages.slice(0, index + 1);
    this.messages(newMessages);

    return true;
  }

  onPermissionRequested(callback: (request: PermissionRequest) => void): () => void {
    const connection = this.connection();
    if (!connection) {
      return () => {};
    }

    return connection.permissionRequested.add((request) => {
      // 动态获取当前 channelId，避免闭包捕获旧值
      if (request.channelId === this.claudeChannelId()) {
        callback(request);
      }
    });
  }

  dispose(): void {
    if (this.effectCleanup) {
      this.effectCleanup();
    }
  }

  private async readMessages(stream: AsyncIterable<any>): Promise<void> {
    try {
      for await (const event of stream) {
        this.processIncomingMessage(event);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    } finally {
      // 流结束时做最终刷新，确保所有待处理消息都已渲染
      this.flushPendingMessages();
      // 流结束（正常/中断/错误）都必须重置 busy 状态
      this.busy(false);
      this.claudeChannelId(undefined);
    }
  }

  // 流式消息批量更新：多个事件合并到同一帧渲染，避免每个 chunk 都触发完整 Vue 重渲染
  private _pendingMessages: Message[] | null = null;
  private _flushScheduled = false;

  private flushPendingMessages(): void {
    this._flushScheduled = false;
    if (this._pendingMessages) {
      this.messages(this._pendingMessages);
      this._pendingMessages = null;
    }
  }

  private processIncomingMessage(event: any): void {
    // 1. 复用待处理数组，避免每次事件都拷贝整个消息数组
    const currentMessages = this._pendingMessages ?? [...this.messages()] as Message[];

    // 2. 处理特殊消息（TodoWrite, usage 等）
    this.processMessage(event);

    // 3. 使用工具函数处理消息：
    //    - 关联 tool_result 到 tool_use（响应式更新）
    //    - 将原始事件转换为 Message 并添加到数组
    processAndAttachMessage(currentMessages, event);

    // 4. 更新其他状态
    if (event?.type === 'system') {
      this.sessionId(event.session_id);
      if (event.subtype === 'init') {
        this.busy(true);
      }
    } else if (event?.type === 'result') {
      this.busy(false);
    }

    // 5. 批量更新 messages signal：
    //    重要事件（system/result）立即刷新，流式文本事件合并到下一帧
    const isTerminal = event?.type === 'system' || event?.type === 'result';
    if (isTerminal) {
      this._pendingMessages = null;
      this._flushScheduled = false;
      this.messages(currentMessages);
    } else {
      this._pendingMessages = currentMessages;
      if (!this._flushScheduled) {
        this._flushScheduled = true;
        requestAnimationFrame(() => this.flushPendingMessages());
      }
    }
  }

  /**
   * 处理特殊消息（TodoWrite, usage 统计）
   */
  private processMessage(event: any): void {
    if (
      event.type === 'assistant' &&
      event.message?.content &&
      Array.isArray(event.message.content)
    ) {
      // 处理 TodoWrite
      for (const block of event.message.content) {
        if (
          block.type === 'tool_use' &&
          block.name === 'TodoWrite' &&
          block.input &&
          typeof block.input === 'object' &&
          'todos' in block.input
        ) {
          this.todos(block.input.todos);
        }
      }

      // 处理 usage 统计
      if (event.message.usage) {
        this.updateUsage(event.message.usage);
      }
    }
  }

  private captureSnapshot(): SessionSnapshot {
    return {
      permissionMode: this.permissionMode(),
      modelSelection: this.modelSelection(),
      thinkingLevel: this.thinkingLevel(),
      timestamp: Date.now()
    };
  }

  private recordSnapshot(reason: string): SessionSnapshot {
    const snapshot = this.captureSnapshot();
    this.history.push(snapshot);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    this.redoStack = [];
    console.debug('[Session] snapshot', { reason, snapshot });
    return snapshot;
  }

  private discardSnapshot(snapshot: SessionSnapshot): void {
    const last = this.history[this.history.length - 1];
    if (last && last.timestamp === snapshot.timestamp) {
      this.history.pop();
    }
  }

  private async applySnapshot(target: SessionSnapshot, rollback: SessionSnapshot): Promise<boolean> {
    this.permissionMode(target.permissionMode);
    this.modelSelection(target.modelSelection);
    this.thinkingLevel(target.thinkingLevel);

    const channelId = this.claudeChannelId();
    if (!channelId) {
      return true;
    }
    try {
      const connection = await this.getConnection();
      const permissionOk = await connection.setPermissionMode(channelId, target.permissionMode);
      const modelResp = target.modelSelection
        ? await connection.setModel(channelId, { value: target.modelSelection })
        : { success: true };
      await connection.setThinkingLevel(channelId, target.thinkingLevel);
      if (!permissionOk || modelResp?.success === false) {
        throw new Error('sync failed');
      }
      return true;
    } catch (error) {
      this.permissionMode(rollback.permissionMode);
      this.modelSelection(rollback.modelSelection);
      this.thinkingLevel(rollback.thinkingLevel);
      await this.context.showNotification?.('撤销失败，请重试', 'error');
      console.error('[Session] undo failed', error);
      return false;
    }
  }

  /**
   * 更新 token 使用统计
   */
  private updateUsage(usage: any): void {
    const totalTokens =
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      usage.output_tokens;

    const current = this.usageData();
    this.usageData({
      totalTokens,
      totalCost: current.totalCost,
      contextWindow: current.contextWindow
    });
  }

  private buildUserMessage(
    input: string,
    attachments: AttachmentPayload[],
    selection?: SelectionRange
  ): any {
    const content: any[] = [];

    if (selection?.selectedText) {
      content.push({
        type: 'text',
        text: `<ide_selection>The user selected the lines ${selection.startLine} to ${selection.endLine} from ${selection.filePath}:
${selection.selectedText}

This may or may not be related to the current task.</ide_selection>`
      });
    }

    for (const attachment of attachments) {
      const { fileName, mediaType, data } = attachment;
      if (!data) {
        console.error(`Attachment missing data: ${fileName}`);
        continue;
      }

      const normalizedType = (mediaType || 'application/octet-stream').toLowerCase();

      if (IMAGE_MEDIA_TYPES.includes(normalizedType as (typeof IMAGE_MEDIA_TYPES)[number])) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: normalizedType,
            data
          }
        });
        continue;
      }

      if (normalizedType === 'text/plain') {
        try {
          const decoded = typeof globalThis.atob === 'function' ? globalThis.atob(data) : '';
          content.push({
            type: 'document',
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: decoded
            },
            title: fileName
          });
          continue;
        } catch (error) {
          console.error('Failed to decode text attachment', error);
        }
      }

      if (normalizedType === 'application/pdf') {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data
          },
          title: fileName
        });
        continue;
      }

      console.error(`Unsupported attachment type: ${fileName} (${normalizedType})`);
    }

    content.push({ type: 'text', text: input });

    return {
      type: 'user',
      session_id: '',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content
      }
    };
  }

  private isSlashCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  private isSameSelection(a?: SelectionRange, b?: SelectionRange): boolean {
    if (!a && !b) {return true;}
    if (!a || !b) {return false;}
    return (
      a.filePath === b.filePath &&
      a.startLine === b.startLine &&
      a.endLine === b.endLine &&
      a.startColumn === b.startColumn &&
      a.endColumn === b.endColumn &&
      a.selectedText === b.selectedText
    );
  }
}
