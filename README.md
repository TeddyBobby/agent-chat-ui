# Agent Chat UI 🤖

A beautiful, modern chat interface for AI agents — built with Next.js 14, TypeScript, and Tailwind CSS.

**Live Demo**: [agent-chat-ui.vercel.app](https://agent-chat-ui.vercel.app)

![Agent Chat UI](public/screenshot.png)

## ✨ Features

- **Streaming Chat** — Real-time token-by-token streaming via Server-Sent Events (SSE)
- **Tool Call Visualization** — See exactly what tools the agent calls, with expandable argument/result cards
- **Multi-Model Support** — Works with any OpenAI-compatible API (OpenAI, Anthropic, DeepSeek, Ollama, Groq, etc.)
- **Markdown Rendering** — Full GFM markdown with syntax highlighting for code blocks
- **Conversation Management** — Create, switch, and delete conversations; all stored locally
- **Dark Mode** — System-aware light/dark theme
- **Responsive** — Works on desktop and mobile
- **Zero Dependencies for State** — Uses localStorage, no external state management library

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/TeddyBobby/agent-chat-ui.git
cd agent-chat-ui

# Install
npm install

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click the ⚙️ settings icon to enter your API key.

## 🔧 Configuration

| Env Variable | Description |
|-------------|-------------|
| `OPENAI_API_KEY` | Your API key (can also be entered in the UI) |
| `OPENAI_BASE_URL` | Custom API endpoint (default: `https://api.openai.com/v1`) |

### Using with Ollama (local models)

1. Start Ollama: `ollama serve`
2. Set base URL to `http://localhost:11434/v1`
3. Use model name like `gemma3` or `llama3`
4. API key can be any non-empty string (e.g., `ollama`)

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| Streaming | Server-Sent Events (SSE) |
| Icons | Inline SVG (zero icon library dependency) |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/chat/
│   │   └── route.ts        # Streaming chat API endpoint
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main chat page
├── components/
│   └── chat/
│       ├── chat-input.tsx    # Message input + settings
│       ├── message-bubble.tsx # Individual message display
│       ├── message-list.tsx   # Scrollable message list
│       ├── sidebar.tsx        # Conversation sidebar
│       └── tool-call-card.tsx # Tool call expandable card
└── lib/
    ├── store.ts              # Conversation state management
    └── types.ts              # TypeScript type definitions
```

## 🤝 Contributing

Pull requests welcome! For major changes, please open an issue first.

## 📄 License

MIT © [TeddyBobby](https://github.com/TeddyBobby)
