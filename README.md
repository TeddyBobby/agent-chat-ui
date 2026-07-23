# {{Pi}}Agent — AI Coding Agent

A beautiful, local-first AI coding agent interface. Chat with LLMs, attach files, browse your filesystem, and watch tools execute in real-time.

Built with Next.js, TypeScript, and Tailwind CSS.

![{{Pi}}Agent](public/screenshot.png)

## Features

- **Agent-driven coding** — read, write, edit, search files and run commands in your project directory
- **Project directory selector** — pick any folder via built-in file browser; agent operates within that scope
- **Structured streaming** — tool calls render as live cards with running/completed/error states
- **File attachments** — drag or select files, previewed inline with line numbers (non-text files show icon only)
- **Multi-model** — OpenAI, DeepSeek, Ollama, or any OpenAI-compatible API
- **Markdown rendering** — GFM tables, code blocks with syntax highlighting
- **Persistent settings** — model, API key, and project directory survive refreshes
- **Dark mode** — zinc-based premium dark theme

## Quick Start

```bash
git clone https://github.com/TeddyBobby/agent-chat-ui.git
cd agent-chat-ui
npm install
npm run dev
```

Open http://localhost:3001, click the model name to open settings, pick a model and enter your API key.

### Ollama (local)

```bash
ollama pull gemma4
npm run dev
```

Select "Gemma 4 (本地)" in the model dropdown — no API key needed.

### DeepSeek

1. Get an API key from [platform.deepseek.com](https://platform.deepseek.com)
2. Select "DeepSeek V4 Flash" or "DeepSeek V4 Pro"
3. Enter your key — it's saved locally

Or set `DEEPSEEK_API_KEY` in `.env.local`.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Default API key |
| `OPENAI_BASE_URL` | Custom base URL (default: `https://api.openai.com/v1`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | DeepSeek base URL (default: `https://api.deepseek.com/v1`) |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts   # SSE streaming agent endpoint
│   │   └── fs/route.ts     # Filesystem browser API
│   ├── layout.tsx
│   ├── page.tsx            # Main chat + SSE event handling
│   └── globals.css
├── components/chat/
│   ├── chat-input.tsx      # Input + file upload + settings
│   ├── directory-picker.tsx # Filesystem browser modal
│   ├── message-list.tsx
│   ├── message-bubble.tsx  # Message + file cards + tool summary
│   ├── sidebar.tsx
│   └── tool-call-card.tsx  # Compact collapsible tool cards
├── lib/
│   ├── agent/
│   │   ├── core.ts         # PiAgent: ReAct loop with function calling
│   │   └── tools.ts        # read_file, write_file, edit_file, search_code, run_command
│   ├── store.ts            # localStorage persistence
│   └── types.ts            # Types + model registry + SSE event types
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Streaming | SSE (Server-Sent Events) with Node.js Readable |
| Storage | localStorage |

## License

MIT © [TeddyBobby](https://github.com/TeddyBobby)
