'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/types';
import { useTheme } from '@/components/theme-provider';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  runningConvId: string | null;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({ conversations, activeId, runningConvId, onSelect, onArchive, onRestore, onDelete, onNewChat }: SidebarProps) {
  const { dark, toggle } = useTheme();
  const isStreaming = runningConvId !== null;
  const [view, setView] = useState<'active' | 'archived'>('active');

  const archivedConvs = conversations.filter(c => c.archived);
  const activeConvs = conversations.filter(c => !c.archived);

  return (
    <div className="w-60 h-full flex flex-col bg-gray-50 dark:bg-zinc-900/80 border-r border-gray-200 dark:border-zinc-800/50">
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
        <a href="/" className="flex items-center gap-2.5 px-2 mb-3 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 tracking-tight">{'{{Pi}}'}Agent</span>
        </a>
        <button
          onClick={() => onNewChat()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700/80 border border-gray-200 dark:border-zinc-700/50 hover:border-gray-300 dark:hover:border-zinc-600/50 transition-all text-[13px] font-medium text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建对话
        </button>
      </div>

      {/* Tab toggle */}
      <div className="px-3 pb-1">
        <div className="flex rounded-lg bg-gray-100 dark:bg-zinc-800/50 p-0.5">
          <button
            onClick={() => setView('active')}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
              view === 'active'
                ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 shadow-sm'
                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            活跃
          </button>
          <button
            onClick={() => setView('archived')}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
              view === 'archived'
                ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 shadow-sm'
                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            归档{archivedConvs.length > 0 ? ` (${archivedConvs.length})` : ''}
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {(view === 'active' ? activeConvs : archivedConvs).length === 0 ? (
          <p className="text-[12px] text-gray-400 dark:text-zinc-500 text-center py-12 px-3 leading-relaxed">
            {view === 'active' ? '暂无对话' : '暂无归档'}
          </p>
        ) : (
          (view === 'active' ? activeConvs : archivedConvs).map((conv) => {
            const isActive = activeId === conv.id;
            const isRunning = conv.id === runningConvId;
            const isArchivedView = view === 'archived';

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20'
                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 text-[13px]">
                  {isRunning ? (
                    <span className="w-3 h-3 border-2 border-indigo-400/60 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}`}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                  <span className={`truncate flex-1 font-medium ${
                    isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-600 dark:text-zinc-400'
                  }`}>
                    {conv.title || '新对话'}
                  </span>

                  {isArchivedView ? (
                    <>
                      {/* Restore button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all flex-shrink-0"
                        title="恢复"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                      </button>
                      {/* Permanent delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0"
                        title="永久删除"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </>
                  ) : (
                    /* Archive button */
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchive(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-500 dark:hover:text-amber-400 transition-all flex-shrink-0"
                      title="归档"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="21 8 21 21 3 21 3 8"/>
                        <rect x="1" y="3" width="22" height="5"/>
                        <line x1="10" y1="12" x2="14" y2="12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-zinc-800/50">
        <div className="flex items-center justify-between px-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${isStreaming ? 'bg-amber-400 shadow-amber-400/50 animate-pulse' : 'bg-emerald-400 shadow-emerald-400/50'}`} />
            <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium tracking-wide">
              {isStreaming ? 'RUNNING' : 'READY'}
            </span>
          </div>
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
