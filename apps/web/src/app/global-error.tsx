'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Agent Chat UI — global error:', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <div role="alert" className="text-center max-w-md px-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            严重错误
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
            应用遇到严重错误，无法继续运行。这可能是临时问题——请尝试重新加载。
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-gray-400 dark:text-gray-600 mb-4">
              错误 ID：{error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-all shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
