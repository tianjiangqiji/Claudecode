<template>
  <ToolMessageWrapper
    tool-icon="codicon-eye-two"
    tool-name="Read"
    :tool-result="toolResult"
  >
    <template #main>
      <span class="tool-label">{{ lineRangeLabel }}</span>
      <ToolFilePath
        v-if="filePath"
        :file-path="filePath"
        :context="context"
        :start-line="startLine"
        :end-line="endLine"
      />
    </template>

    <!-- 动态展开内容：仅在有错误时显示 -->
    <template v-if="toolResult?.is_error" #expandable>
      <ToolError :tool-result="toolResult" />
    </template>
  </ToolMessageWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ToolContext } from '@/types/tool';
import ToolMessageWrapper from './common/ToolMessageWrapper.vue';
import ToolFilePath from './common/ToolFilePath.vue';
import ToolError from './common/ToolError.vue';

interface Props {
  toolUse?: any;
  toolResult?: any;
  toolUseResult?: any;
  context?: ToolContext;
}

const props = defineProps<Props>();

const filePath = computed(() => {
  return props.toolUse?.input?.file_path || props.toolUse?.input?.notebook_path || '';
});

const offset = computed(() => {
  return props.toolUse?.input?.offset;
});

const limit = computed(() => {
  return props.toolUse?.input?.limit;
});

// 计算起始行号和结束行号（用于文件跳转和框选）
const startLine = computed(() => {
  return offset.value !== undefined ? offset.value + 1 : 1;
});

const endLine = computed(() => {
  if (offset.value !== undefined && limit.value !== undefined) {
    return offset.value + limit.value;
  } else if (limit.value !== undefined) {
    return limit.value;
  }
  return undefined;
});

const lineRangeLabel = computed(() => {
  if (offset.value !== undefined && limit.value !== undefined) {
    const start = offset.value + 1;
    const end = offset.value + limit.value;
    return `读取第 ${start}-${end} 行`;
  } else if (offset.value !== undefined) {
    return `从第 ${offset.value + 1} 行开始读取`;
  } else if (limit.value !== undefined) {
    return `读取第 1-${limit.value} 行`;
  } else {
    return '读取';
  }
});
</script>

<style scoped>
.tool-label {
  font-weight: 500;
  color: var(--vscode-foreground);
  font-size: 0.9em;
}
</style>
