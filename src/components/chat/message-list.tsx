'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/types';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            AI 助手聊天
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            与 AI Agent 对话，支持流式输出、工具调用可视化和多模型切换。
            点击左下角设置图标输入 API 密钥开始。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {streaming && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400">
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
