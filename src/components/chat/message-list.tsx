'use client';

import { useEffect, useRef, useLayoutEffect } from 'react';
import { Message } from '@/lib/types';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const prevLastContentRef = useRef('');

  // Auto-scroll when new messages arrive or content changes (streaming)
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lastMsg = messages[messages.length - 1];
    const newMsgArrived = messages.length > prevLengthRef.current;
    const contentChanged = lastMsg && lastMsg.content !== prevLastContentRef.current;

    if (newMsgArrived || (streaming && contentChanged)) {
      // During streaming, use instant scroll; after new message, smooth
      bottomRef.current?.scrollIntoView({
        behavior: streaming ? 'instant' : 'smooth',
      });
    }

    prevLengthRef.current = messages.length;
    if (lastMsg) prevLastContentRef.current = lastMsg.content;
  }, [messages, streaming]);

  // Also scroll on first load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl shadow-lg shadow-violet-500/20">
            🤖
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            AI 助手聊天
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            与 AI Agent 对话，支持流式输出、Markdown 渲染、代码高亮和工具调用可视化。
            点击左下角设置图标，选择模型并输入 API 密钥即可开始。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="pb-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      {streaming && (
        <div className="flex items-center gap-1.5 px-8 py-2">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
