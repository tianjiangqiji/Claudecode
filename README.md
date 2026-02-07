# Claudecode - AI Coding Assistant | AI 智能编程助手

<p align="center">
  <img src="resources/claude-logo.png" alt="Claudecode Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Multi-protocol AI Coding Assistant for VSCode</strong><br>
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
  <a href="#features--功能特性">Features</a> •
  <a href="#quick-start--快速开始">Quick Start</a> •
  <a href="#supported-ai-services--支持的-ai-服务">AI Services</a> •
  <a href="#configuration--配置说明">Configuration</a> •
  <a href="#development--开发指南">Development</a> •
  <a href="#acknowledgements--鸣谢">Credits</a>
</p>

---

## Introduction | 简介

Claudecode is a powerful VSCode extension that integrates multiple AI LLMs directly into your editor. It provides an interactive chat interface, intelligent code analysis, file operations, terminal command execution, and more — making AI your true coding partner.

Claudecode 是一个功能强大的 VSCode 扩展，将多种 AI 大语言模型直接集成到你的编辑器中。它提供了交互式聊天界面、智能代码分析、文件操作、终端命令执行等丰富功能，让 AI 成为你真正的编程搭档。

Unlike other AI coding assistants, Claudecode supports **multi-protocol, multi-provider** access. You can freely choose from OpenAI, Anthropic, Gemini and connect to any OpenAI API-compatible third-party service.

与其他 AI 编程助手不同，Claudecode 支持**多协议多服务商**接入，你可以自由选择 OpenAI、Anthropic、Gemini 等不同的 AI 服务，甚至接入任何 OpenAI API 兼容的第三方服务。

<p align="center">
  <img src="resources/screenshot-chat.png" alt="Claudecode Chat Interface" width="400">
  <br>
  <em>Claudecode Chat — AI-powered sidebar conversation</em>
</p>

## Features | 功能特性

### Multi-Protocol AI Support | 多协议 AI 支持

- **OpenAI Compatible** — Supports `/v1/chat/completions` protocol, compatible with OpenAI, DeepSeek, Qwen, Moonshot, etc.
- **Anthropic Direct** — Supports `/v1/messages` protocol for Claude models
- **Google Gemini** — Supports `/v1beta/models` protocol for Gemini models

### Intelligent Coding Assistant | 智能编程助手

- **Interactive Chat** — Sidebar chat with Markdown, code highlighting, LaTeX support
- **Session Management** — Multiple sessions, history, session restore
- **Streaming Response** — Real-time streaming output

### Powerful Tool Integration | 强大的工具集成

- **File Read/Write** — Smart file operations with diff preview
- **Batch Edit** — Modify multiple files in one operation
- **Terminal Commands** — Execute commands directly in the editor
- **Content Search** — Grep content search and Glob file finder
- **Web Search** — Search the internet for latest information
- **Notebook Editing** — Jupyter Notebook support
- **MCP Tools** — Model Context Protocol extension tools

### Append Rules | 追加规则

- **Custom Append Rules** — Define rules that automatically append to every message sent to AI
- **Per-workspace or Global** — Configure rules that apply globally or per workspace
- **Enable/Disable Toggle** — Quickly toggle append rules on or off from the settings page
- **Default Template** — Ships with a sensible default rule template

自定义追加规则 — 每次发送消息时自动追加到内容末尾，用于引导 AI 按照你的习惯回答。支持全局规则，可在设置页面快速启用/禁用，自带默认模板。

### Message Queue | 消息队列

- **Auto Queue** — Messages sent while AI is responding are automatically queued
- **Auto Send** — Queued messages are sent sequentially after AI completes each response
- **Queue Management** — View, remove individual items, or clear the entire queue
- **Visual Indicator** — Queue appears above the input box with message count

消息队列 — AI 回复中发送的消息自动排队，AI 完成后按顺序自动发送。支持查看、移除、清空队列，队列显示在输入框上方。

### Drag & Drop Support | 拖拽支持

- **Image Drag** — Drag images directly into the input box as attachments (no Shift needed)
- **File Path Insert** — Drag non-image files to insert their full absolute path
- **@Mention Mode** — Hold Shift while dragging to insert workspace-relative `@path` mentions
- **Clipboard Paste** — Paste images from clipboard as attachments

拖拽支持 — 直接拖入图片作为附件，拖入非图片文件插入绝对路径，按住 Shift 拖拽使用 @mention 相对路径引用。支持从剪贴板粘贴图片。

### Security & Control | 安全与控制

- **Three Modes** — Agent (default, auto-execute edits), Normal (requires confirmation), Plan (planning only)
- **Permission Approval** — Sensitive operations require explicit authorization
- **Transparent Tool Calls** — All AI tool usage is fully visible

三种操作模式 — Agent（默认，自动执行编辑）、Normal（需确认）、Plan（仅规划不执行）

### User Experience | 用户体验

- **Chinese Interface** — All UI elements localized in Chinese
- **Custom Models** — Add any custom model ID and display name
- **In-plugin Settings** — Complete all configuration without leaving the editor
- **Smart Scrolling** — History viewing won't be interrupted by new messages
- **Explicit Save Button** — Save configuration with a dedicated save button

## Supported AI Services | 支持的 AI 服务

| Provider | Protocol | Streaming | Description |
|----------|----------|:---------:|-------------|
| **OpenAI** | `/v1/chat/completions` | ✅ | Compatible with all OpenAI API format services |
| **Anthropic** | `/v1/messages` | ✅ | Direct Anthropic API, Claude model series |
| **Gemini** | `/v1beta/models` | ✅ | Google Gemini API |

> **Tip**: Via OpenAI-compatible protocol, connect to DeepSeek, Qwen, Moonshot, Yi, Groq, Together AI, and any OpenAI API-compatible service.
>
> **提示**：通过 OpenAI 兼容协议，可接入 DeepSeek、通义千问、Moonshot、零一万物、Groq、Together AI 等任何支持 OpenAI API 格式的服务。

## Quick Start | 快速开始

### Install from Source | 从源码安装

```bash
git clone https://github.com/crispvibe/Claudecode.git
cd Claudecode
pnpm install
pnpm build
pnpm package
```

Install the generated `.vsix` file via **Extensions → Install from VSIX** in VSCode.

在 VSCode 中通过 **扩展 → 从 VSIX 安装** 来安装生成的 `.vsix` 文件。

### First Setup | 首次配置

1. Click the Claudecode icon in the Activity Bar to open the sidebar
2. Click the ⚙️ gear icon to enter Settings
3. Select an AI Provider (OpenAI / Anthropic / Gemini)
4. Enter API Key and Base URL (if needed)
5. Add custom models (optional)
6. Configure append rules (optional)
7. Return to chat and start coding with AI

## Configuration | 配置说明

### Provider Config | Provider 配置

| Setting | Description | Example |
|---------|-------------|---------|
| **Provider** | AI service provider | `openai` / `anthropic` / `gemini` |
| **API Key** | Provider API key | `sk-xxxx...` |
| **Base URL** | Custom API endpoint | `https://api.deepseek.com` |
| **Custom Models** | Custom model ID and name | ID: `gpt-4o`, Name: `GPT-4o` |
| **Extra Headers** | Custom HTTP headers (JSON) | `{"X-Custom": "value"}` |
| **Append Rules** | Auto-append text to every message | Custom instruction template |

### Third-Party Examples | 接入第三方服务示例

**DeepSeek:**
- Provider: `openai`
- Base URL: `https://api.deepseek.com`
- Models: `deepseek-chat` / `deepseek-reasoner`

**Qwen (通义千问):**
- Provider: `openai`
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode`
- Models: `qwen-plus` / `qwen-max`

**Moonshot (Kimi):**
- Provider: `openai`
- Base URL: `https://api.moonshot.cn`
- Models: `moonshot-v1-128k`

## Architecture | 项目架构

```
Claudecode/
├── src/
│   ├── services/              # Backend services
│   │   ├── claude/            # Claude Agent (message routing, session mgmt)
│   │   └── llm/               # LLM Provider abstraction
│   │       ├── providers/     # Provider implementations (OpenAI/Anthropic/Gemini)
│   │       ├── ILLMProvider.ts
│   │       └── LLMProviderService.ts
│   └── webview/               # Frontend (Vue 3)
│       └── src/
│           ├── components/    # UI components (chat, messages, tools)
│           ├── pages/         # Pages (ChatPage, SettingsPage)
│           ├── core/          # Core logic (Session, Connection)
│           └── composables/   # Vue composables
├── resources/                 # Static assets
├── package.json
└── esbuild.ts
```

### Tech Stack | 技术栈

- **Backend**: TypeScript + VSCode Extension API + esbuild
- **Frontend**: Vue 3 + Vite + TailwindCSS
- **Communication**: WebView message protocol (bidirectional async)
- **AI SDK**: Claude Agent SDK + Custom HTTP Provider adapter

## Development | 开发指南

### Requirements | 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0
- VSCode >= 1.98.0

### Dev Mode | 开发模式

```bash
pnpm dev    # Start HMR dev server (Vite + esbuild watch)
```

### Build Commands | 构建命令

```bash
pnpm build              # Build all (frontend + backend)
pnpm build:extension    # Build backend only
pnpm build:webview      # Build frontend only
pnpm package            # Package as VSIX
pnpm test               # Run tests
pnpm typecheck:all      # TypeScript type check
```

## Contributing | 贡献指南

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Submit a Pull Request

## Acknowledgements | 鸣谢

This project is based on [Claudix](https://github.com/Haleclipse/Claudix) open source project.

本项目基于 [Claudix](https://github.com/Haleclipse/Claudix) 开源项目二次开发。

Thanks to [Haleclipse](https://github.com/Haleclipse) for the outstanding work and open-source spirit.

感谢原作者 [Haleclipse](https://github.com/Haleclipse) 的杰出工作和开源精神。

## License | 许可证

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) — Based on [Claudix](https://github.com/Haleclipse/Claudix) © Haleclipse

---

<p align="center">
  <sub>Made with ❤️ by <a href="https://github.com/crispvibe">Anna</a></sub>
</p>
