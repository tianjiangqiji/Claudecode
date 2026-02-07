<template>
  <div class="empty-state-content">
    <ClawdIcon class="empty-mascot" />
    <p class="empty-state-message">{{ currentTip }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ClawdIcon from './ClawdIcon.vue';

interface Props {
  platform: string;
}

const props = defineProps<Props>();

const tips = computed(() => {
  const platformKey = props.platform === 'windows' ? 'Alt' : 'Option';
  return [
    '不知道从哪开始？可以问问这个代码库，或者我们直接开始写代码。',
    "准备好了吗？\n让我们写点值得部署的东西。",
    '输入 /model 来选择合适的模型。',
    '创建 CLAUDE.md 文件，AI 每次都会读取其中的指令。',
    "不想重复自己？用 CLAUDE.md 让 AI 记住你的偏好。",
    '按 Shift + Tab 自动批准代码编辑。',
    `选中文本后按 ${platformKey} + K 开始对话。`,
    '使用规划模式在提交前讨论大的改动。按 Shift + Tab 切换模式。',
    "一个人的废料是另一个人的宝藏。",
    "今天是用电脑的好日子，你说呢？",
    "你来对地方了！",
    '在终端中使用 Claude Code 配置 MCP 服务器。\n这里也能用！'
  ];
});

const currentTip = ref(tips.value[0]);

onMounted(() => {
  // 随机选择一条提示
  const index = Math.floor(Math.random() * tips.value.length);
  currentTip.value = tips.value[index];
});
</script>

<style scoped>
.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 16px;
}

.empty-mascot {
  width: 47px;
  height: 38px;
}

.empty-state-message {
  margin: 0;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  white-space: pre-line;
  max-width: 400px;
}
</style>
