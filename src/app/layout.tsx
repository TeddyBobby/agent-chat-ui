import type { Metadata } from 'next';
import './globals.css';
import 'highlight.js/styles/github-dark.css';

export const metadata: Metadata = {
  title: '{{Pi}}Agent',
  description: 'AI coding agent — read, write, search, execute. Powered by your LLM.',
  keywords: ['AI', 'agent', 'coding', 'LLM', 'DeepSeek', 'Next.js'],
  authors: [{ name: 'TeddyBobby' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark antialiased">
      <body className="min-h-screen bg-zinc-950 text-zinc-200">
        {children}
      </body>
    </html>
  );
}
