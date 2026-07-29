'use client';

import { useState, useEffect } from 'react';
import { ToolCall } from '@/lib/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  search_code: 'Search',
  run_command: 'Run',
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  const isRunning = toolCall.status === 'running';
  const isDone = toolCall.status === 'completed';
  const isError = toolCall.status === 'error';
  const hasResult = !!(toolCall.result || toolCall.error);

  // 完成后保留 visible 300ms，做视觉过渡
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (isRunning) {
      setVisible(true);
    } else if (visible) {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [isRunning]);

  const a = toolCall.args || {};
  const argsPreview = a.path
    ? String(a.path).split('/').pop()
    : a.command
    ? String(a.command).slice(0, 50)
    : a.pattern
    ? String(a.pattern)
    : '';

  return (
    <div className={`border rounded-md overflow-hidden text-[12px] transition-all duration-300 ${
      isRunning
        ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-500/[0.04]'
        : visible
        ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/[0.04]'
        : isError
        ? 'border-red-500/20 bg-red-50 dark:bg-red-500/[0.03]'
        : 'border-gray-200 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-900/30'
    }`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {/* Status icon */}
        {isRunning ? (
          <span className="w-3 h-3 border-2 border-amber-400/60 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
        ) : visible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 animate-fade-in-up">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : isDone ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
        )}

        <span className={`font-semibold tracking-wider uppercase flex-shrink-0 transition-colors duration-300 ${
          isRunning ? 'text-amber-600 dark:text-amber-300'
          : visible ? 'text-emerald-600 dark:text-emerald-300'
          : 'text-gray-500 dark:text-zinc-400'
        }`}>
          {label}
        </span>

        <span className="text-gray-400 dark:text-zinc-500 font-mono truncate flex-1">
          {argsPreview}
        </span>

        <span className={`text-[10px] font-medium flex-shrink-0 transition-colors duration-300 ${
          isRunning ? 'text-amber-500 animate-pulse'
          : visible ? 'text-emerald-500'
          : isDone ? 'text-emerald-500'
          : 'text-red-500'
        }`}>
          {isRunning ? '···' : visible ? '✓' : isDone ? 'done' : 'error'}
        </span>
      </div>
    </div>
  );
}
