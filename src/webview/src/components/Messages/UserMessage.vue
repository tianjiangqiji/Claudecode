<template>
  <div class="user-message">
    <div class="message-wrapper">
      <div
        class="message-content"
        :class="{ editing: isEditing }"
      >
        <!-- 普通显示模式 -->
        <div
          v-if="!isEditing"
          class="message-view"
          role="button"
          tabindex="0"
          @click.stop="startEditing"
          @keydown.enter.prevent="startEditing"
          @keydown.space.prevent="startEditing"
        >
          <div class="message-text">
            <div>{{ displayContent }}</div>
            <button
              class="restore-button"
              @click.stop="handleRestore"
              title="Restore checkpoint"
            >
              <span class="codicon codicon-restore"></span>
            </button>
          </div>
        </div>

        <!-- 编辑模式 -->
        <div v-else class="edit-mode">
          <ChatInputBox
            :show-progress="false"
            :conversation-working="false"
            :attachments="attachments"
            :selected-model="selectedModel"
            :permission-mode="permissionMode"
            submit-behavior="ctrlEnter"
            ref="chatInputRef"
            @submit="handleSaveEdit"
            @stop="cancelEdit"
            @remove-attachment="handleRemoveAttachment"
            @model-select="handleModelSelect"
            @mode-select="handleModeSelect"
          />
          <div class="edit-actions">
            <button class="edit-apply-btn" @click="handleApplyEdit">应用修改</button>
            <button class="edit-cancel-btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, inject } from 'vue';
import { RuntimeKey } from '../../composables/runtimeContext';
import { useSessionStore } from '../../composables/useSessionStore';
import ChatInputBox from '../ChatInputBox.vue';
import type { AttachmentItem } from '../../types/attachment';
import type { Message } from '../../models/Message';

const props = defineProps<{
  message: Message;
}>();

const emit = defineEmits<{
  edit: [string];
}>();

const runtime = inject(RuntimeKey);
const store = runtime ? useSessionStore(runtime.sessionStore) : undefined;
const activeSession = computed(() => store?.activeSession.value);
const selectedModel = computed(() => activeSession.value?.modelSelection());
const permissionMode = computed(() => activeSession.value?.permissionMode());

const chatInputRef = ref<InstanceType<typeof ChatInputBox> | null>(null);
const isEditing = ref(false);
const attachments = ref<AttachmentItem[]>([]);

const displayContent = computed(() => {
  if (typeof props.message.message.content === 'string') {
    return props.message.message.content;
  }
  if (Array.isArray(props.message.message.content)) {
    return props.message.message.content
      .map(wrapper => wrapper.content)
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
  return '';
});

// 处理模型切换
async function handleModelSelect(modelId: string) {
  const session = activeSession.value;
  if (session) {
    await session.setModel({ value: modelId }, 'history');
  }
}

// 处理模式切换
async function handleModeSelect(mode: any) {
  const session = activeSession.value;
  if (session) {
    await session.setPermissionMode(mode, true, 'history');
  }
}

// 从消息内容中提取附件（image 和 document blocks）
function extractAttachments(): AttachmentItem[] {
  // 兼容旧版 string 类型内容
  if (typeof props.message.message.content === 'string') {
    return [];
  }

  if (typeof props.message.message.content === 'string') {
    return [];
  }

  if (!Array.isArray(props.message.message.content)) {
    return [];
  }

  const extracted: AttachmentItem[] = [];
  let index = 0;

  for (const wrapper of props.message.message.content) {
    const block = wrapper.content;

    if (block.type === 'image' && block.source?.type === 'base64') {
      const ext = block.source.media_type?.split('/')[1] || 'png';
      extracted.push({
        id: `image-${index++}`,
        fileName: `image.${ext}`,
        mediaType: block.source.media_type || 'image/png',
        data: block.source.data,
        fileSize: 0, // 历史消息无法获取原始大小
      });
    } else if (block.type === 'document' && block.source) {
      const title = block.title || 'document';
      extracted.push({
        id: `document-${index++}`,
        fileName: title,
        mediaType: block.source.media_type || 'application/octet-stream',
        data: block.source.data,
        fileSize: 0,
      });
    }
  }

  return extracted;
}

async function startEditing() {
  isEditing.value = true;

  // 提取附件
  attachments.value = extractAttachments();

  // 等待 DOM 更新后设置输入框内容和焦点
  await nextTick();
  if (chatInputRef.value) {
    chatInputRef.value.setContent?.(displayContent.value || '');
    chatInputRef.value.focus?.();
  }
}

function handleRemoveAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

function cancelEdit() {
  isEditing.value = false;
  attachments.value = []; // 清空附件列表
}

async function handleSaveEdit(content?: string) {
  const session = activeSession.value;
  if (!session) {return;}
  if (session.busy?.()) {
    await runtime?.appContext.showNotification?.('当前对话进行中，无法提交编辑', 'warning');
    return;
  }

  const input = (content ?? chatInputRef.value?.getContent?.() ?? displayContent.value).trim();
  if (!input && attachments.value.length === 0) {
    return;
  }

  const payloads = attachments.value.map(a => ({
    fileName: a.fileName,
    mediaType: a.mediaType,
    data: a.data,
    fileSize: a.fileSize
  }));

  try {
    await session.send(input || ' ', payloads);
    cancelEdit();
  } catch (error) {
    await runtime?.appContext.showNotification?.('提交编辑失败', 'error');
    console.error('[UserMessage] Save edit failed', error);
  }
}

function handleApplyEdit() {
  void handleSaveEdit(chatInputRef.value?.getContent?.());
}

async function handleRestore() {
  const session = activeSession.value;
  if (!session) {return;}
  
  const choice = await session.showMessage(
    'warning',
    '确定要回滚到此消息吗？\n\n注意：这将删除此消息之后的所有对话记录。',
    ['仅撤回聊天记录', '回滚聊天记录与在此区间编辑的文件', '取消'],
    false
  );

  if (!choice || choice === '取消') {
    return;
  }

  const rewindFiles = choice === '回滚聊天记录与在此区间编辑的文件';
  await session.rollbackToMessage(props.message, { rewindFiles });
}

// 监听键盘事件
function handleKeydown(event: KeyboardEvent) {
  if (isEditing.value && event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

// 生命周期管理
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.user-message {
  display: block;
  outline: none;
  padding: 1px 12px 8px;
  background-color: var(--vscode-sideBar-background);
  opacity: 1;
}

.message-wrapper {
  background-color: transparent;
}

/* 消息内容容器 - 负责背景色和圆角 */
.message-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  background-color: color-mix(
    in srgb,
    var(--vscode-sideBar-background) 60%,
    transparent
  );
  outline: none;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  position: relative;
  transition: all 0.2s ease;
}

.message-content.editing {
  z-index: 200;
  border: none;
  background-color: transparent;
}

/* 普通显示模式 */
.message-view {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  width: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.message-view .message-text {
  cursor: pointer;
  background-color: color-mix(
    in srgb,
    var(--vscode-input-background) 60%,
    transparent
  );
  outline: none;
  border-radius: 6px;
  width: 100%;
  padding: 6px 8px;
  box-sizing: border-box;
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.message-view .message-text:hover {
  background-color: color-mix(
    in srgb,
    var(--vscode-input-background) 70%,
    transparent
  );
}

.message-text > div:first-child {
  min-width: 0;
  height: min-content;
  max-height: 72px;
  overflow: hidden;
  line-height: 1.5;
  font-family: inherit;
  font-size: 13px;
  color: var(--vscode-input-foreground);
  background-color: transparent;
  outline: none;
  border: none;
  overflow-wrap: break-word;
  word-break: break-word;
  padding: 0;
  user-select: text;
  white-space: pre-wrap;
  flex: 1;
}

/* restore checkpoint 按钮 */
.restore-button {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  display: flex;
  width: 20px;
  align-items: center;
  justify-content: center;
  line-height: 17px;
  padding: 0 6px;
  height: 26px;
  box-sizing: border-box;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.1s ease;
}

.restore-button:hover {
  background-color: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
}

.restore-button .codicon {
  font-size: 12px;
  color: var(--vscode-foreground);
}

/* 编辑模式 */
.edit-mode {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.edit-apply-btn,
.edit-cancel-btn {
  height: 24px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--vscode-button-border, transparent);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 12px;
}

.edit-apply-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.edit-apply-btn:hover,
.edit-cancel-btn:hover {
  filter: brightness(1.05);
}

/* 编辑模式下的特定样式覆盖 */
.edit-mode :deep(.full-input-box) {
  background: var(--vscode-input-background);
}

.edit-mode :deep(.full-input-box:focus-within) {
  box-shadow: 0 0 8px 2px
    color-mix(in srgb, var(--vscode-input-background) 30%, transparent);
}
</style>
