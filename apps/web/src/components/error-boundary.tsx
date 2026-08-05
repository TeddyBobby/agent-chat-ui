'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Component-level error boundary that catches rendering errors in child
 * components without crashing the entire page. Use this around chat messages,
 * tool calls, and other dynamic content that might fail during rendering.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] caught render error:', error, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-red-500,#ef4444)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">
            Display Error
          </h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 text-center max-w-xs mb-4 leading-relaxed">
            This section failed to render. Your data is safe — try reloading.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Retry
          </button>
          <details className="mt-4 max-w-md w-full">
            <summary className="text-[10px] text-gray-400 dark:text-zinc-600 cursor-pointer hover:text-gray-500 dark:hover:text-zinc-400 text-center">
              Error details
            </summary>
            <pre className="mt-2 p-3 rounded-md bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-[10px] font-mono text-gray-500 dark:text-zinc-400 whitespace-pre-wrap overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
