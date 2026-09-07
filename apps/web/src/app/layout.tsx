import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import 'highlight.js/styles/github.css';
import { ThemeProvider } from '@/components/theme-provider';
import { THEME_STORAGE_KEY } from '@/components/theme-state';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  title: '{{Pi}}Agent',
  description: 'AI coding agent — read, write, search, execute. Powered by your LLM.',
  keywords: ['AI', 'agent', 'coding', 'LLM', 'DeepSeek', 'Next.js'],
  authors: [{ name: 'TeddyBobby' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: '{{Pi}}Agent',
    description: 'AI coding agent — read, write, search, execute. Powered by your LLM.',
    type: 'website',
    siteName: 'PiAgent',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: '{{Pi}}Agent',
    description: 'AI coding agent — read, write, search, execute. Powered by your LLM.',
  },
  applicationName: 'PiAgent',
  appleWebApp: { capable: true, title: 'PiAgent', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="antialiased" suppressHydrationWarning>
      <head>
        {/* 首帧前同步读取主题偏好，避免深色用户看到白屏闪烁。
            逻辑与 ThemeProvider 内的 resolveDark 保持一致。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
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
