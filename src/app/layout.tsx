import type { Metadata } from 'next';
import './globals.css';
import 'highlight.js/styles/github-dark.css';

export const metadata: Metadata = {
  title: 'Agent Chat UI — Chat with AI Agents',
  description:
    'A beautiful chat interface for AI agents. Supports streaming, tool call visualization, and multiple LLM providers (OpenAI, Anthropic, DeepSeek, Ollama).',
  keywords: ['AI', 'chat', 'agent', 'LLM', 'OpenAI', 'Next.js', 'streaming'],
  authors: [{ name: 'TeddyBobby' }],
  openGraph: {
    title: 'Agent Chat UI',
    description: 'Chat with AI agents — streaming, tool calls, multi-model support',
    url: 'https://github.com/TeddyBobby/agent-chat-ui',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
