# PiAgent

本地优先的 AI 编程助手。项目使用 pnpm monorepo 管理 Next.js 前端、持久化任务服务器、Agent 运行时、共享协议和 Electron 桌面应用。

## 功能

- OpenAI、DeepSeek、Ollama 及其他 OpenAI-compatible API
- 读文件、写文件、精确编辑、代码搜索和命令执行
- SQLite 持久化对话、消息、工具调用、任务及事件
- 可重放 SSE：刷新页面或断开连接不会取消后台任务
- API Key 使用 AES-256-GCM 加密保存，登出时删除
- Electron 本地桌面版，Web 和 API 自动使用空闲端口

## 环境要求

- Node.js 20+
- pnpm 11（仓库声明版本为 `pnpm@11.4.0`）
- macOS arm64 打包需要系统自带的 `hdiutil`

## 开发运行

```bash
pnpm install
pnpm dev
```

- Web UI：<http://localhost:3001/chat>
- API Server：<http://127.0.0.1:8787>
- 健康检查：<http://127.0.0.1:8787/health>

默认数据库位于 `.data/pi-agent.db`。可复制 `.env.example` 中的变量到运行环境，或者直接在界面设置里保存 API Key。

## Electron

在本地准备隔离的桌面运行包并启动：

```bash
pnpm electron
```

构建当前支持的 macOS arm64 安装包：

```bash
pnpm package:mac
```

产物位于：

```text
release/PiAgent-0.2.0-arm64.dmg
release/mac-arm64/PiAgent.app
```

桌面应用将静态 Web、后端运行包和 `better-sqlite3` 一并封装，不依赖源码目录或本机开发服务器。Web 与 API 监听 `127.0.0.1` 的动态空闲端口；数据库保存在 Electron `userData` 目录。

当前安装包未使用 Apple Developer ID 签名。其他 Mac 首次运行时可能需要在“系统设置 → 隐私与安全性”中确认打开。

## API Key

在设置中输入 API Key 后点击“保存”（输入框失焦时也会保存）：

1. 浏览器不会把明文写入 `localStorage`。
2. 后端使用 AES-256-GCM 加密后写入 SQLite。
3. 主密钥来自 `PI_AGENT_MASTER_KEY`，或存放在数据库旁权限为 `0600` 的独立 `.key` 文件。
4. 页面刷新、新对话和应用重启后继续复用。
5. 点击“已保存 · 登出”后删除密钥。

生产环境中必须稳定保管 `PI_AGENT_MASTER_KEY`；更换或丢失它会导致已有密文无法解密。

## Monorepo

```text
apps/
  web/       Next.js UI、服务端快照投影和 SSE 重连
  server/    HTTP API、SQLite、CredentialVault、RunManager
  desktop/   Electron 主进程、静态资源服务器和打包脚本
packages/
  agent/     PiAgent 模型循环、上下文压缩和本地工具
  contracts/ 前后端共享实体、命令和事件协议
docs/        当前架构、Agent、上下文和流式协议说明
```

## 任务恢复语义

```text
POST /v1/conversations/:id/runs       -> 202 + Run
GET  /v1/runs/:id/events?after=<seq>  -> 历史重放 + 实时 SSE
POST /v1/runs/:id/cancel              -> 显式取消
```

任务生命周期和页面订阅生命周期彼此独立。事件先提交到 SQLite，再发送给订阅者；页面刷新后从最后的 `seq` 继续连接。相同 `idempotencyKey` 不会重复启动 Agent。

完全退出 Electron 或重启 API 进程会终止正在执行的模型流；下次启动时对应任务会标记为 `interrupted`，已经落库的消息与工具结果仍然可见。

## 服务端部署边界

API Server 可以独立部署，但它能读取文件、写文件和执行命令，不应未经认证直接暴露到公网。当前版本定位为单用户、本地优先应用。多用户部署需要增加用户认证、租户数据隔离、工作区沙箱、限流和审计。

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

服务端集成测试覆盖断线重放、幂等启动、失败状态、加密凭据跨重启复用、登出清除和本地 API 来源限制。

## License

MIT © TeddyBobby
