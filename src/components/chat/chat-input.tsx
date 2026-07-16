'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MODELS } from '@/lib/types';

interface ChatInputProps {
  onSend: (content: string) => void;
  onModelChange: (modelId: string) => void;
  selectedModel: string;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  disabled: boolean;
}

export function ChatInput({
  onSend, onModelChange, selectedModel, apiKey, onApiKeyChange, disabled,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedModelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="border-t border-gray-200/60 dark:border-gray-800/60 bg-gradient-to-t from-gray-50/80 to-white dark:from-gray-950 dark:to-gray-950 px-4 sm:px-8 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* Model badge & settings bar */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 font-medium">
              {selectedModelName}
            </span>
          </button>
        </div>

        {showSettings && (
          <div className="mb-3 p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 animate-in">
            <div className="flex gap-3 items-center flex-wrap">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                模型
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                API 密钥
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="sk-... 或 ollama"
                  className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs w-44"
                />
              </label>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              兼容 OpenAI 格式 API。选择「Gemma 4 (本地)」自动连接 Ollama。
            </p>
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-end bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:border-violet-400/50 focus-within:shadow-md focus-within:shadow-violet-500/5 transition-all px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息...（Enter 发送，Shift+Enter 换行）"
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed focus:outline-none disabled:opacity-50 placeholder-gray-400 dark:placeholder-gray-500"
          />

          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
