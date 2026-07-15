'use client';

import { ToolCall } from '@/lib/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const statusIcon = {
    running: '⏳',
    completed: '✅',
    error: '❌',
  }[toolCall.status];

  const statusColor = {
    running: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30',
    completed: 'border-green-400 bg-green-50 dark:bg-green-950/30',
    error: 'border-red-400 bg-red-50 dark:bg-red-950/30',
  }[toolCall.status];

  return (
    <details className={`my-2 border rounded-lg ${statusColor} overflow-hidden`}>
      <summary className="px-3 py-2 cursor-pointer text-sm font-medium flex items-center gap-2 select-none">
        <span>{statusIcon}</span>
        <span className="text-gray-700 dark:text-gray-300 font-mono">{toolCall.name}</span>
        <span className="text-xs text-gray-400 ml-auto">
          {toolCall.status === 'running' ? 'running...' : toolCall.status}
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Arguments</div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 rounded p-2 overflow-x-auto font-mono">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
        {toolCall.result && (
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Result</div>
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 rounded p-2 overflow-x-auto font-mono max-h-48 overflow-y-auto">
              {toolCall.result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
