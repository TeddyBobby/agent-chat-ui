'use client';

import { ToolCall } from '@/lib/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const STATUS_CONFIG: Record<string, { icon: string; border: string; bg: string; label: string }> = {
  running: {
    icon: '⏳', label: '执行中',
    border: 'border-yellow-400/50', bg: 'bg-yellow-50/80 dark:bg-yellow-950/20',
  },
  completed: {
    icon: '✓', label: '完成',
    border: 'border-emerald-400/50', bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
  },
  error: {
    icon: '✗', label: '失败',
    border: 'border-red-400/50', bg: 'bg-red-50/80 dark:bg-red-950/20',
  },
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const config = STATUS_CONFIG[toolCall.status] || STATUS_CONFIG.running;

  return (
    <details className={`border rounded-xl overflow-hidden ${config.border} ${config.bg} shadow-sm`}>
      <summary className="px-3 py-2 cursor-pointer text-xs font-medium flex items-center gap-2 select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <span className="font-mono text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          {config.icon}
        </span>
        <span className="font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {toolCall.name}
        </span>
        <span className={`text-[10px] ml-auto px-1.5 py-0.5 rounded-full font-medium ${
          toolCall.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
          toolCall.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
        }`}>
          {config.label}
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            参数
          </div>
          <pre className="text-[11px] bg-gray-100 dark:bg-gray-900/80 rounded-lg p-2.5 overflow-x-auto font-mono leading-relaxed text-gray-700 dark:text-gray-300">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
        {toolCall.result && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              结果
            </div>
            <pre className="text-[11px] bg-gray-100 dark:bg-gray-900/80 rounded-lg p-2.5 overflow-x-auto font-mono leading-relaxed max-h-48 overflow-y-auto text-gray-700 dark:text-gray-300">
              {toolCall.result}
            </pre>
          </div>
        )}
        {toolCall.error && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">错误</div>
            <pre className="text-[11px] bg-red-50 dark:bg-red-950/20 rounded-lg p-2.5 overflow-x-auto font-mono leading-relaxed text-red-700 dark:text-red-400">
              {toolCall.error}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
