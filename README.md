# Claudecode - AI 智能编程助手

<p align="center">
  <img src="resources/claude-logo.png" alt="Claudecode Logo" width="128" height="128">
</p>

<p align="center">
  <strong>多协议 AI 智能编程助手 — 在 VSCode 中与 AI 实时协作编程</strong>
</p>

<p align="center">
  <a href="https://github.com/crispvibe/Claudecode"><img src="https://img.shields.io/github/stars/crispvibe/Claudecode?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <img src="https://img.shields.io/badge/VS%20Code-%3E%3D1.98.0-blue?style=flat-square&logo=visual-studio-code" alt="VS Code">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?style=flat-square&logo=vue.js" alt="Vue 3">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square" alt="License">
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#支持的-ai-服务">AI 服务</a> •
  <a href="#配置说明">配置说明</a> •
  <a href="#开发指南">开发指南</a> •
  <a href="#鸣谢">鸣谢</a>
</p>

---

## 简介

Claudecode 是一个功能强大的 VSCode 扩展，将多种 AI 大语言模型直接集成到你的编辑器中。它提供了交互式聊天界面、智能代码分析、文件操作、终端命令执行等丰富功能，让 AI 成为你真正的编程搭档。

与其他 AI 编程助手不同，Claudecode 支持**多协议多服务商**接入，你可以自由选择 Claude Code SDK、OpenAI、Anthropic、Gemini 等不同的 AI 服务，甚至接入任何 OpenAI API 兼容的第三方服务。

<p align="center">
  <img src="resources/screenshot-chat.png" alt="Claudecode 聊天界面" width="400">
  <br>
  <em>Claudecode 聊天界面 — 侧边栏中与 AI 实时对话</em>
</p>

## 功能特性

### 多协议 AI 支持

- **Claude Code SDK** — 原生集成 Claude Code CLI，获得最佳的代码理解和工具调用体验
- **OpenAI 兼容** — 支持 `/v1/chat/completions` 协议，兼容 OpenAI、DeepSeek、通义千问、Moonshot 等所有兼容服务
- **Anthropic 直连** — 支持 `/v1/messages` 协议，直接调用 Anthropic API
- **Gemini** — 支持 `/v1beta/models` 协议，接入 Google Gemini 系列模型

### 智能编程助手

- **交互式聊天** — 侧边栏聊天界面，支持 Markdown 渲染、代码高亮、LaTeX 公式
- **会话管理** — 多会话支持、历史记录、会话恢复，不丢失任何对话上下文
- **流式响应** — 实时流式输出，即时看到 AI 的思考过程

### 强大的工具集成

- **文件读写** — 智能读取、创建、编辑代码文件，支持差异对比预览
- **批量编辑** — 一次性修改多个文件的多个位置
- **终端命令** — 在编辑器中直接执行终端命令，支持后台运行
- **内容搜索** — Grep 内容搜索和 Glob 文件查找
- **网页搜索** — 搜索互联网获取最新信息
- **笔记本编辑** — 支持 Jupyter Notebook 编辑
- **MCP 工具** — 支持 Model Context Protocol 扩展工具

### 安全与控制

- **三种操作模式** — Normal（需确认）、Agent（自动执行编辑）、Plan（仅规划不执行）
- **权限审批** — 敏感操作需用户明确授权，保障代码安全
- **工具调用透明** — 所有 AI 工具调用过程完全可见

### 用户体验

- **完全中文界面** — 所有 UI 元素均已中文本地化
- **自定义模型** — 支持添加任意自定义模型 ID 和显示名称
- **插件内配置** — 无需离开编辑器，在插件设置页面完成所有配置
- **智能滚动** — 查看历史消息时不会被新消息打断

## 支持的 AI 服务

| Provider | 协议 | 流式支持 | 说明 |
|----------|------|:--------:|------|
| **Claude Code** | SDK 原生 | ✅ | 通过 Claude Code CLI 二进制文件通信，支持完整工具链 |
| **OpenAI** | `/v1/chat/completions` | ✅ | 兼容所有 OpenAI API 格式的服务（含第三方） |
| **Anthropic** | `/v1/messages` | ✅ | Anthropic API 直连，支持 Claude 系列模型 |
| **Gemini** | `/v1beta/models` | ✅ | Google Gemini API，支持 Gemini 系列模型 |

> **提示**：通过 OpenAI 兼容协议，你可以接入 DeepSeek、通义千问、Moonshot、零一万物、Groq、Together AI 等任何支持 OpenAI API 格式的服务。

## 快速开始

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/crispvibe/Claudecode.git
cd Claudecode

# 安装依赖
pnpm install

# 构建扩展
pnpm build

# 打包为 VSIX
pnpm package
```

在 VSCode 中通过 **扩展 → 从 VSIX 安装** 来安装生成的 `.vsix` 文件。

### 首次配置

1. 安装后，点击左侧活动栏的 Claudecode 图标打开侧边栏
2. 点击右上角 ⚙️ 齿轮图标进入设置页面
3. 选择 AI 服务提供商（Provider）
4. 填入 API Key 和 Base URL（如需要）
5. 添加自定义模型（可选）
6. 返回聊天页面，开始与 AI 对话

## 配置说明

### Provider 配置

在插件内置设置页面中可配置：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **Provider 类型** | 选择 AI 服务提供商 | `openai` / `anthropic` / `gemini` / `claude-code` |
| **API Key** | 对应 Provider 的 API 密钥 | `sk-xxxx...` |
| **Base URL** | 自定义 API 端点 | `https://api.deepseek.com` |
| **默认模型** | 默认使用的模型 ID | `deepseek-chat` |
| **自定义模型** | 添加自定义模型 ID 和显示名称 | ID: `gpt-4o`, 名称: `GPT-4o` |
| **额外请求头** | JSON 格式的自定义 HTTP 请求头 | `{"X-Custom": "value"}` |

### 接入第三方服务示例

**DeepSeek：**
- Provider: `openai`
- Base URL: `https://api.deepseek.com`
- 自定义模型: `deepseek-chat` / `deepseek-reasoner`

**通义千问：**
- Provider: `openai`
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode`
- 自定义模型: `qwen-plus` / `qwen-max`

**Moonshot（Kimi）：**
- Provider: `openai`
- Base URL: `https://api.moonshot.cn`
- 自定义模型: `moonshot-v1-128k`

## 项目架构

```
Claudecode/
├── src/
│   ├── services/              # 后端服务层
│   │   ├── claude/            # Claude Agent 服务（消息路由、会话管理）
│   │   └── llm/               # LLM Provider 抽象层
│   │       ├── providers/     # 各 Provider 实现（OpenAI/Anthropic/Gemini）
│   │       ├── ILLMProvider.ts # Provider 接口定义
│   │       └── LLMProviderService.ts  # Provider 管理服务
│   └── webview/               # 前端 WebView（Vue 3）
│       └── src/
│           ├── components/    # UI 组件（聊天、消息、工具渲染）
│           ├── pages/         # 页面（ChatPage、SettingsPage）
│           ├── core/          # 核心逻辑（Session、Connection）
│           └── composables/   # Vue 组合式函数
├── resources/                 # 静态资源（图标、SVG）
├── package.json               # 扩展配置
└── esbuild.ts                 # 构建脚本
```

### 技术栈

- **后端**：TypeScript + VSCode Extension API + esbuild
- **前端**：Vue 3 + Vite + TailwindCSS
- **通信**：WebView 消息协议（双向异步）
- **AI SDK**：Claude Agent SDK + 自研 HTTP Provider 适配层

## 开发指南

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0
- VSCode >= 1.98.0

### 开发模式

```bash
# 启动热更新开发服务器
pnpm dev
```

将同时启动：
- **Vite 开发服务器**（端口 5173）— WebView 前端热更新
- **esbuild 监视器** — 扩展后端实时编译

### 调试

- **F5 运行扩展** — 完整构建后启动调试
- **Run Extension (HMR)** — 前端热更新模式，快速迭代

### 构建命令

```bash
pnpm build              # 构建全部（前端 + 后端）
pnpm build:extension    # 仅构建后端
pnpm build:webview      # 仅构建前端
pnpm package            # 打包为 VSIX
pnpm test               # 运行测试
pnpm typecheck:all      # TypeScript 类型检查
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 鸣谢

本项目基于 [Claudix](https://github.com/Haleclipse/Claudix) 开源项目二次开发。

感谢原作者 [Haleclipse](https://github.com/Haleclipse) 的杰出工作和开源精神，为本项目奠定了坚实的基础。

## 许可证

本项目采用 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) 许可证。

基于 [Claudix](https://github.com/Haleclipse/Claudix) © Haleclipse | AGPL-3.0

---

<p align="center">
  <sub>Made with ❤️ by <a href="https://github.com/crispvibe">Anna</a></sub>
</p>
