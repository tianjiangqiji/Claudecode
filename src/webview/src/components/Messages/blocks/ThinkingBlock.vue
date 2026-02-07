<template>
  <div class="thinking-block">
    <div class="thinking-header" @click="toggleExpanded">
      <span class="thinking-label">Thinking...</span>
      <span class="codicon" :class="expanded ? 'codicon-chevron-up' : 'codicon-chevron-down'" />
    </div>
    <div v-if="expanded" class="thinking-content">
      {{ block.thinking }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { ThinkingBlock as ThinkingBlockType } from '../../../models/ContentBlock';

interface Props {
  block: ThinkingBlockType;
}

defineProps<Props>();

const expanded = ref(true);
let autoCollapseTimer: ReturnType<typeof setTimeout> | null = null;

function toggleExpanded() {
  expanded.value = !expanded.value;
  // 手动展开时清除自动收起计时器
  if (autoCollapseTimer) {
    clearTimeout(autoCollapseTimer);
    autoCollapseTimer = null;
  }
}

// 挂载时默认展开，3秒后自动收起
onMounted(() => {
  autoCollapseTimer = setTimeout(() => {
    expanded.value = false;
    autoCollapseTimer = null;
  }, 3000);
});

onUnmounted(() => {
  if (autoCollapseTimer) {
    clearTimeout(autoCollapseTimer);
  }
});
</script>

<style scoped>
.thinking-block {
  margin: 4px 0;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.thinking-header .codicon {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
  transition: opacity 0.1s ease;
}

.thinking-header:hover .codicon {
  opacity: 1;
}

.thinking-label {
  font-size: 14px;
  font-style: italic;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.thinking-header:hover .thinking-label {
  opacity: 1;
}

.thinking-content {
  margin-left: 16px;
  padding: 4px 0;
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--app-secondary-foreground);
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
