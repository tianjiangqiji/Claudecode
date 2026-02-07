<template>
  <DropdownTrigger
    align="left"
    :close-on-click-outside="true"
  >
    <template #trigger>
      <div class="model-dropdown">
        <div class="dropdown-content">
          <div class="dropdown-text">
            <span class="dropdown-label">{{ selectedModelLabel }}</span>
          </div>
        </div>
        <div class="codicon codicon-chevron-up chevron-icon text-[12px]!" />
      </div>
    </template>

    <template #content="{ close }">
      <template v-if="modelList.length > 0">
        <DropdownItem
          v-for="(model, index) in modelList"
          :key="model.id"
          :item="{
            id: model.id,
            label: model.label,
            checked: selectedModel === model.id,
            type: 'model'
          }"
          :is-selected="selectedModel === model.id"
          :index="index"
          @click="(item) => handleModelSelect(item, close)"
        />
      </template>
      <div v-else class="empty-models-hint">
        请在设置中添加自定义模型
      </div>
    </template>
  </DropdownTrigger>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { DropdownTrigger, DropdownItem, type DropdownItemData } from './Dropdown'
import { RuntimeKey } from '../composables/runtimeContext'

interface ModelEntry {
  id: string
  label: string
  description?: string
  provider?: string
}

interface Props {
  selectedModel?: string
}

interface Emits {
  (e: 'modelSelect', modelId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedModel: ''
})

const emit = defineEmits<Emits>()

const runtime = inject(RuntimeKey)

// 从 claudeConfig 动态获取模型列表
const modelList = computed<ModelEntry[]>(() => {
  const conn = runtime?.connectionManager.connection()
  const config = conn?.claudeConfig?.()

  // 如果 config 中有模型列表，使用动态列表
  if (config?.models && Array.isArray(config.models) && config.models.length > 0) {
    return config.models.map((m: any) => ({
      id: m.value || m.id || '',
      label: m.label || m.value || m.id || '',
      description: m.description,
      provider: m.provider,
    }))
  }

  // 兜底：无自定义模型时返回空列表
  // 用户需要在设置中添加自定义模型
  return []
})

// 计算显示的模型名称
const selectedModelLabel = computed(() => {
  const model = modelList.value.find(m => m.id === props.selectedModel)
  if (model) return model.label

  // 兜底
  if (modelList.value.length > 0) return modelList.value[0].label
  return '选择模型'
})

function handleModelSelect(item: DropdownItemData, close: () => void) {
  console.log('Selected model:', item)
  close()

  // 发送模型切换事件
  emit('modelSelect', item.id)
}
</script>

<style scoped>
/* Model 下拉样式 - 简洁透明样式 */
.model-dropdown {
  display: flex;
  gap: 4px;
  font-size: 12px;
  align-items: center;
  line-height: 24px;
  min-width: 0;
  max-width: 100%;
  padding: 2.5px 6px;
  border-radius: 23px;
  flex-shrink: 1;
  cursor: pointer;
  border: none;
  background: transparent;
  overflow: hidden;
  transition: background-color 0.2s ease;
}

.model-dropdown:hover {
  background-color: var(--vscode-inputOption-hoverBackground);
}

/* 共享的 Dropdown 样式 */
.dropdown-content {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.dropdown-text {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 12px;
  display: flex;
  align-items: baseline;
  gap: 3px;
  height: 13px;
  font-weight: 400;
}

.dropdown-label {
  opacity: 0.8;
  max-width: 120px;
  overflow: hidden;
  height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chevron-icon {
  font-size: 9px;
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--vscode-foreground);
}

.empty-models-hint {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  white-space: nowrap;
}
</style>
