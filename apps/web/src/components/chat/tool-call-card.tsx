'use client';

import { useState } from 'react';
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
  const [expanded, setExpanded] = useState(isRunning);

  const a = toolCall.args || {};
  const argsPreview = a.path
    ? String(a.path).split('/').pop()
    : a.command
    ? String(a.command).slice(0, 50)
    : a.pattern
    ? String(a.pattern)
    : '';

  return (
    <div className={`overflow-hidden rounded-md border text-[12px] transition-colors ${
      isRunning
        ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-500/[0.04]'
        : isError
        ? 'border-red-500/20 bg-red-50 dark:bg-red-500/[0.03]'
        : 'border-gray-200 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-900/30'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
        aria-expanded={expanded}
        aria-label={`${expanded ? '收起' : '展开'} ${label} 工具详情`}
      >
        {/* Status icon */}
        {isRunning ? (
          <span className="w-3 h-3 border-2 border-amber-400/60 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
        ) : isDone ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
        )}

        <span className={`font-semibold tracking-wider uppercase flex-shrink-0 transition-colors duration-300 ${
          isRunning ? 'text-amber-600 dark:text-amber-300'
          : 'text-gray-500 dark:text-zinc-400'
        }`}>
          {label}
        </span>

        <span className="text-gray-400 dark:text-zinc-500 font-mono truncate flex-1">
          {argsPreview}
        </span>

        <span className={`text-[10px] font-medium flex-shrink-0 transition-colors duration-300 ${
          isRunning ? 'text-amber-500 animate-pulse'
          : isDone ? 'text-emerald-500'
          : 'text-red-500'
        }`}>
          {isRunning ? '运行中' : isDone ? 'done' : 'error'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-black/[0.06] px-3 py-2 dark:border-white/[0.06]">
          <ToolDetail label="参数" value={JSON.stringify(toolCall.args || {}, null, 2)} />
          {hasResult && (
            <ToolDetail
              label={isError ? '错误' : '结果'}
              value={toolCall.error || toolCall.result || ''}
              error={isError}
            />
          )}
          {isRunning && !hasResult && (
            <p className="text-[10px] text-amber-600 dark:text-amber-300">工具正在执行，结果将在完成后显示。</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolDetail({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return (
    <section>
      <p className={`mb-1 text-[9px] font-medium uppercase tracking-wide ${
        error ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'
      }`}>
        {label}
      </p>
      <pre className="!m-0 max-h-56 overflow-auto !rounded-md !border-0 !bg-black/[0.04] p-2 dark:!bg-black/20">
        <code className={`!bg-transparent !p-0 !text-[10px] !leading-4 ${
          error ? '!text-red-600 dark:!text-red-300' : '!text-gray-600 dark:!text-zinc-300'
        }`}>
          {value || '—'}
        </code>
      </pre>
    </section>
  );
}
