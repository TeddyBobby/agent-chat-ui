'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/types';
import { ToolCallCard } from './tool-call-card';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`py-5 px-4 sm:px-8 ${isUser ? 'bg-white dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-900/60'}`}>
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
            isUser
              ? 'bg-gray-800 dark:bg-gray-600 text-white'
              : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm'
          }`}
        >
          {isUser ? '我' : 'AI'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            {isUser ? '我' : 'AI 助手'}
          </div>

          {isUser ? (
            <div className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <div className="prose prose-base dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-gray-100
              prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-relaxed
              prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-900 dark:prose-strong:text-gray-100
              prose-blockquote:border-l-violet-400 prose-blockquote:bg-gray-100 dark:prose-blockquote:bg-gray-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
              prose-table:border prose-table:rounded-lg prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
              [&_pre]:!rounded-xl [&_pre]:!shadow-sm
              [&_pre_code]:!bg-transparent [&_pre_code]:!p-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content || ''}
              </ReactMarkdown>
            </div>
          )}

          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {message.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
