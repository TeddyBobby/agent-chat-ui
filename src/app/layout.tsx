import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import 'highlight.js/styles/github-dark.css';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: '{{Pi}}Agent',
  description: 'AI coding agent — read, write, search, execute. Powered by your LLM.',
  keywords: ['AI', 'agent', 'coding', 'LLM', 'DeepSeek', 'Next.js'],
  authors: [{ name: 'TeddyBobby' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="antialiased" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-200">
        <ThemeProvider>
          <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
            {children}
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
