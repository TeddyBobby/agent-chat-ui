'use client';

import { useEffect, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { Message } from '@/lib/types';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const autoScrollRef = useRef(true);
  const programmaticRef = useRef(false);

  const scrollToBottom = useCallback((smooth = false) => {
    programmaticRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    if (smooth) {
      setTimeout(() => { programmaticRef.current = false; }, 500);
    } else {
      requestAnimationFrame(() => { programmaticRef.current = false; });
    }
  }, []);

  // scroll 事件：只在用户手动滚动时触发
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (programmaticRef.current) return;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist > 80) {
        autoScrollRef.current = false;
        setShowScrollBtn(true);
      } else {
        autoScrollRef.current = true;
        setShowScrollBtn(false);
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  });

  // 每次渲染后自动滚底
  useLayoutEffect(() => {
    if (autoScrollRef.current) {
      programmaticRef.current = true;
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      requestAnimationFrame(() => { programmaticRef.current = false; });
    }
  });

  // 新消息强制开启 autoScroll
  useEffect(() => {
    autoScrollRef.current = true;
    setShowScrollBtn(false);
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-200 mb-1.5 tracking-tight">{'{{Pi}}'}Agent</h2>
          <p className="text-[13px] text-gray-400 dark:text-zinc-500 leading-relaxed">
            选择一个模型和项目目录，然后告诉我你想做什么。
          </p>
        </div>
      </div>
    );
  }

  const lastIdx = messages.length - 1;

  return (
    <div className="flex-1 relative overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            streaming={streaming && i === lastIdx}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={() => {
            autoScrollRef.current = true;
            setShowScrollBtn(false);
            scrollToBottom(true);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 shadow-lg flex items-center justify-center transition-all animate-fade-in-up"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}
    </div>
  );
}
