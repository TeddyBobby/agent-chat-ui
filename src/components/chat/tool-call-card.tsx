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
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  const hasDetail = !!(toolCall.result || toolCall.error) && toolCall.status !== 'running';

  return (
    <div className="border border-zinc-800/50 rounded-md overflow-hidden bg-zinc-900/30 text-[12px]">
      {/* Summary row — always visible */}
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
          hasDetail ? 'cursor-pointer hover:bg-zinc-800/30' : 'cursor-default'
        }`}
      >
        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          toolCall.status === 'running' ? 'bg-amber-400 animate-pulse' :
          toolCall.status === 'completed' ? 'bg-emerald-400' :
          'bg-red-400'
        }`} />

        {/* Label */}
        <span className="font-semibold tracking-wider uppercase text-zinc-400 flex-shrink-0">
          {label}
        </span>

        {/* Args preview */}
        <span className="text-zinc-500 font-mono truncate flex-1">
          {toolCall.arguments?.path
            ? String(toolCall.arguments.path).split('/').pop()
            : toolCall.arguments?.command
            ? String(toolCall.arguments.command).slice(0, 40)
            : toolCall.arguments?.pattern
            ? String(toolCall.arguments.pattern)
            : ''}
        </span>

        {/* Expand indicator */}
        {hasDetail && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-zinc-600 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="border-t border-zinc-800/50 px-2.5 py-2">
          <pre className="text-[11px] bg-zinc-950/80 rounded-md p-2.5 overflow-x-auto font-mono leading-relaxed max-h-40 overflow-y-auto text-zinc-400 border border-zinc-800/30">
            {toolCall.error || toolCall.result?.slice(0, 1000)}
          </pre>
        </div>
      )}
    </div>
  );
}
