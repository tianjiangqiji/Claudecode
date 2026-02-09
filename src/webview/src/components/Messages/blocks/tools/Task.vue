<template>
  <ToolMessageWrapper
    tool-icon="codicon-tasklist"
    :tool-result="toolResult"
    :default-expanded="shouldExpand"
  >
    <template #main>
      <span class="tool-label">子任务</span>
      <span v-if="subagentType" class="agent-badge">{{ subagentType }}</span>
      <span v-if="description" class="description-text">{{ description }}</span>
    </template>

    <template #expandable>
      <!-- Prompt内容 -->
      <div v-if="prompt" class="prompt-section">
        <div class="section-header">
          <span class="codicon codicon-comment-discussion"></span>
          <span>Prompt</span>
        </div>
        <pre class="prompt-content">{{ prompt }}</pre>
      </div>

      <!-- 嵌套子工具调用 -->
      <div v-if="children && children.length > 0" class="children-section">
        <div class="section-header">
          <span class="codicon codicon-split-vertical"></span>
          <span>子任务进展</span>
        </div>
        <div class="children-list">
          <MessageRenderer
            v-for="(child, idx) in children"
            :key="child.uuid || idx"
            :message="child"
            :context="context!"
          />
        </div>
      </div>

      <!-- 错误内容 -->
      <ToolError :tool-result="toolResult" />
    </template>
  </ToolMessageWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSignal } from '@gn8/alien-signals-vue';
import type { ToolContext } from '@/types/tool';
import type { ContentBlockWrapper } from '@/models/ContentBlockWrapper';
import ToolMessageWrapper from './common/ToolMessageWrapper.vue';
import ToolError from './common/ToolError.vue';
import MessageRenderer from '../../MessageRenderer.vue';

interface Props {
  toolUse?: any;
  toolResult?: any;
  toolUseResult?: any;
  wrapper?: ContentBlockWrapper;
  context?: ToolContext;
}

const props = defineProps<Props>();

// 使用 useSignal 追踪嵌套子消息
const children = props.wrapper ? useSignal(props.wrapper.children) : computed(() => []);

// 子代理类型
const subagentType = computed(() => {
  return props.toolUse?.input?.subagent_type || props.toolUseResult?.subagent_type;
});

// 任务描述
const description = computed(() => {
  return props.toolUse?.input?.description || props.toolUseResult?.description;
});

// Prompt内容
const prompt = computed(() => {
  return props.toolUse?.input?.prompt || props.toolUseResult?.prompt;
});

// 判断是否为权限请求阶段
const isPermissionRequest = computed(() => {
  const hasToolUseResult = !!props.toolUseResult;
  const hasToolResult = !!props.toolResult && !props.toolResult.is_error;
  return !hasToolUseResult && !hasToolResult;
});

// 权限请求阶段默认展开,执行完成后不展开
const shouldExpand = computed(() => {
  // 权限请求阶段展开
  if (isPermissionRequest.value) {return true;}

  // 有错误时展开
  if (props.toolResult?.is_error) {return true;}

  return false;
});
</script>

<style scoped>
.tool-label {
  font-weight: 500;
  color: var(--vscode-foreground);
  font-size: 0.9em;
}

.agent-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background-color: color-mix(in srgb, var(--vscode-charts-orange) 20%, transparent);
  color: var(--vscode-charts-orange);
  border-radius: 3px;
  font-size: 0.75em;
  font-weight: 600;
  font-family: var(--vscode-editor-font-family);
}

.description-text {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.85em;
  color: color-mix(in srgb, var(--vscode-foreground) 85%, transparent);
  font-style: italic;
}

.prompt-section {
  margin-bottom: 12px;
}

.children-section {
  margin-top: 12px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 12px;
}

.children-list {
  padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--vscode-panel-border) 50%, transparent);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 0.85em;
  font-weight: 600;
  color: color-mix(in srgb, var(--vscode-foreground) 80%, transparent);
}

.section-header .codicon {
  font-size: 14px;
}

.prompt-content {
  background-color: color-mix(in srgb, var(--vscode-editor-background) 80%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 8px;
  margin: 0;
  font-family: var(--vscode-editor-font-family);
  color: var(--vscode-editor-foreground);
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  font-size: 0.85em;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
