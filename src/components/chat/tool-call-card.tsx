'use client';

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
  const hasResult = !!(toolCall.result || toolCall.error);
  const showDetail = isRunning || hasResult;

  const argsPreview = toolCall.arguments?.path
    ? String(toolCall.arguments.path).split('/').pop()
    : toolCall.arguments?.command
    ? String(toolCall.arguments.command).slice(0, 50)
    : toolCall.arguments?.pattern
    ? String(toolCall.arguments.pattern)
    : '';

  return (
    <div className={`border rounded-md overflow-hidden text-[12px] transition-all ${
      isRunning
        ? 'border-amber-500/30 bg-amber-500/[0.04] animate-pulse-amber'
        : hasResult && toolCall.status === 'error'
        ? 'border-red-500/20 bg-red-500/[0.03]'
        : 'border-zinc-800/50 bg-zinc-900/30'
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {/* Running spinner or status dot */}
        {isRunning ? (
          <span className="w-3 h-3 border-2 border-amber-400/60 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
        ) : toolCall.status === 'completed' ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
        )}

        <span className={`font-semibold tracking-wider uppercase flex-shrink-0 ${
          isRunning ? 'text-amber-300' : 'text-zinc-400'
        }`}>
          {label}
        </span>

        <span className="text-zinc-500 font-mono truncate flex-1">
          {argsPreview}
        </span>

        <span className={`text-[10px] font-medium flex-shrink-0 ${
          isRunning ? 'text-amber-400 animate-pulse' :
          toolCall.status === 'completed' ? 'text-emerald-400' :
          'text-red-400'
        }`}>
          {isRunning ? '···' : toolCall.status === 'completed' ? 'done' : 'error'}
        </span>
      </div>

      {/* Detail: args + result */}
      {showDetail && (
        <div className="border-t border-zinc-800/30">
          {/* Args when running */}
          {isRunning && Object.keys(toolCall.arguments).length > 0 && (
            <div className="px-2.5 py-2">
              <div className="text-[10px] text-zinc-600 mb-1 uppercase tracking-wider">Args</div>
              <pre className="text-[11px] text-zinc-400 font-mono">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}
          {/* Result */}
          {hasResult && (
            <div className="px-2.5 py-2">
              <div className="text-[10px] text-zinc-600 mb-1 uppercase tracking-wider">Result</div>
              <pre className="text-[11px] bg-zinc-950/60 rounded-md p-2.5 overflow-x-auto font-mono leading-relaxed max-h-40 overflow-y-auto text-zinc-400 border border-zinc-800/30">
                {toolCall.error || toolCall.result?.slice(0, 1000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
