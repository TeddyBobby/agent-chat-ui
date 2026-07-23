# {{Pi}}Agent — AI 编程助手

对话式 AI 编程助手。直接在项目中读代码、写文件、执行命令，实时观看工具执行过程。

**在线体验** → [agent-chat-ui-ten.vercel.app/chat](https://agent-chat-ui-ten.vercel.app/chat)

Next.js 16 · TypeScript · Tailwind CSS

## 快速开始

```bash
git clone https://github.com/TeddyBobby/agent-chat-ui.git
cd agent-chat-ui
npm install
npm run dev
```

打开 http://localhost:3001 进入首页，点击「打开工作台」或直接访问 `/chat`。

### 本地模型 (Ollama)

```bash
ollama pull gemma4
npm run dev
```

选择「Gemma 4 (本地)」即可使用，无需 API Key。

### DeepSeek

1. 从 [platform.deepseek.com](https://platform.deepseek.com) 获取 API Key
2. 在设置面板输入 Key，或创建 `.env.local` 设置 `DEEPSEEK_API_KEY`

## 支持模型

| 模型 | 上下文 |
|------|--------|
| DeepSeek V4 Pro（默认） | 1M |
| DeepSeek V4 Flash | 1M |
| Gemma 4 12B / 8B (本地) | 8K–32K |

任意 OpenAI 兼容 API 即插即用。

## 功能

- **Agent 编程** — 读、写、编辑、搜索文件，执行 shell 命令
- **流式输出** — 逐 token 实时渲染，工具调用卡片可视化
- **上下文管理** — 长对话自动摘要压缩，防止超出窗口 → [详细](docs/context-management.md)
- **多会话并发** — 同时处理多个项目，各会话独立运行
- **项目隔离** — 每个会话绑定独立工作目录
- **归档管理** — 归档历史对话，随时恢复
- **亮/暗主题** — 一键切换
- **设置持久化** — 模型、API Key 自动保存

## 文档

| 文档 | 说明 |
|------|------|
| [架构总览](docs/ARCHITECTURE.md) | 项目整体结构、目录说明 |
| [Agent 架构](docs/agent-architecture.md) | PiAgent ReAct 循环、工具系统、上下文压缩 |
| [流式引擎](docs/streaming-engine.md) | 五层渲染架构、SSE 协议、连接管理 |
| [上下文管理](docs/context-management.md) | Token 估算、摘要压缩算法、窗口策略 |

## 架构

```
src/
├── app/api/chat/route.ts    # SSE Agent 端点
├── app/chat/page.tsx        # 聊天主页面
├── lib/agent/
│   ├── core.ts              # PiAgent 框架核心
│   └── tools.ts             # 5 个内置工具
├── lib/stream/
│   └── engine.ts            # 流式渲染引擎（5 层）
├── lib/store.ts             # localStorage 持久化
├── lib/types.ts             # 类型 + 模型注册
├── components/chat/         # UI 组件
└── public/index.html        # Linear 风格首页
```

## 配置

`.env.local`：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |

## 技术栈

Next.js 16 (App Router) · TypeScript · Tailwind CSS · SSE 流式 · localStorage

## License

MIT © [TeddyBobby](https://github.com/TeddyBobby)
