'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Agent Chat UI — page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-3xl shadow-lg shadow-red-500/20">
          ⚠️
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
          An unexpected error occurred while rendering this page. You can try again or refresh the browser.
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-600 mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-all shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Try Again
        </button>
      </div>
    </div>
  );
}
