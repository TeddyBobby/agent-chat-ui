'use client';

import { Conversation } from '@/lib/types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({ conversations, activeId, onSelect, onDelete, onNewChat }: SidebarProps) {
  return (
    <div className="w-64 h-full border-r border-gray-200/60 dark:border-gray-800/60 bg-gray-50/80 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-3 pt-3 pb-1.5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm transition-all text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建对话
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {conversations.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-2">
            暂无对话，点击上方按钮开始
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                activeId === conv.id
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className="flex-shrink-0 opacity-60"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="truncate flex-1">{conv.title || '新对话'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all flex-shrink-0"
                title="删除"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200/60 dark:border-gray-800/60">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-500 dark:text-gray-500">Agent Chat UI</span>
        </div>
      </div>
    </div>
  );
}
