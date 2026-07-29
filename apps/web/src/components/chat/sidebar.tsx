'use client';

import { useState } from 'react';
import type { Conversation } from '@/lib/types';
import { useTheme } from '@/components/theme-provider';
import { AgentMark } from './agent-mark';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  runningConvIds: Set<string>;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => Promise<void>;
  apiKeyConfigured: boolean;
}

const NavIcon = ({ kind }: { kind: 'skills' | 'mcp' | 'chat' }) => {
  if (kind === 'skills') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3h10l4 4v10l-4 4H7l-4-4V7l4-4Z"/><path d="m9 9 6 6m0-6-6 6"/></svg>;
  }
  if (kind === 'mcp') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.4 11 7.2-3.7M8.4 13l7.2 3.7"/></svg>;
  }
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8Z"/><path d="M8 9h8m-8 4h5"/></svg>;
};

export function Sidebar({
  conversations, activeId, runningConvIds, onSelect, onArchive, onRestore, onDelete,
  onNewChat, onLogout, apiKeyConfigured,
}: SidebarProps) {
  const { dark, toggle } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const activeConversations = conversations.filter((conversation) => !conversation.archived);
  const archivedConversations = conversations.filter((conversation) => conversation.archived);

  return (
    <aside className="flex h-full w-[284px] flex-shrink-0 flex-col bg-[#f7f7f5] px-5 pb-5 pt-6 text-[#292929] dark:bg-[#1d1e1b] dark:text-[#eeeeea] lg:w-[284px]">
      <div className="flex items-center gap-2 px-1">
        <AgentMark className="h-8 w-8" compact />
        <span className="text-[17px] font-semibold tracking-[-0.035em]">MOAgent</span>
      </div>

      <nav className="mt-11 rounded-[17px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:bg-[#272824]">
        <button type="button" disabled title="Skills 管理即将开放" className="flex h-[52px] w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-[13px] opacity-60">
          <NavIcon kind="skills" />
          <span>Skills</span>
          <span className="ml-auto text-[#aaa9a4]">›</span>
        </button>
        <button type="button" disabled title="MCP 管理即将开放" className="flex h-[52px] w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-[13px] opacity-60">
          <NavIcon kind="mcp" />
          <span>MCP</span>
          <span className="ml-auto text-[#aaa9a4]">›</span>
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-[52px] w-full items-center gap-3 rounded-xl px-3 text-[13px] transition-colors hover:bg-[#f5f5f2] dark:hover:bg-[#30312d]"
        >
          <NavIcon kind="chat" />
          <span>新对话</span>
          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#f1f1ee] text-base dark:bg-[#383934]">+</span>
        </button>
      </nav>

      <div className="mt-7 flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center px-2 text-[12px] font-medium text-[#676762] dark:text-[#b7b7b1]"
        >
          工作空间
          <span className={`ml-auto transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
        </button>

        <div className="mt-5 flex items-center px-2">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`text-[12px] font-medium ${showArchived ? 'text-[#aaa9a4]' : 'text-[#292929] dark:text-white'}`}
          >
            最近会话
          </button>
          {activeConversations.length > 0 && (
            <span className="ml-2 rounded-full bg-[#65d45e] px-2 py-0.5 text-[9px] font-bold text-[#21431f]">
              {activeConversations.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className="ml-auto text-[10px] text-[#aaa9a4] hover:text-[#676762]"
          >
            {showArchived ? '返回' : '归档'}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
            {(showArchived ? archivedConversations : activeConversations).map((conversation) => {
              const active = conversation.id === activeId;
              const running = runningConvIds.has(conversation.id);
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] transition-colors ${
                    active ? 'bg-white text-[#262626] shadow-sm dark:bg-[#292a26] dark:text-white' : 'text-[#777771] hover:bg-white/70 dark:text-[#a5a59f] dark:hover:bg-[#292a26]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left focus:outline-none focus-visible:underline"
                  >
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${running ? 'animate-pulse bg-[#65d45e]' : 'bg-[#d0d0cb]'}`} />
                    <span className="min-w-0 flex-1 truncate">{conversation.title || '新对话'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (showArchived) onRestore(conversation.id);
                      else onArchive(conversation.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                    title={showArchived ? '恢复' : '归档'}
                  >
                    {showArchived ? '↩' : '…'}
                  </button>
                  {showArchived && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onDelete(conversation.id); }}
                      className="opacity-0 text-red-400 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                      title="永久删除"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {(showArchived ? archivedConversations : activeConversations).length === 0 && (
              <p className="px-2 py-5 text-[10px] text-[#aaa9a4]">{showArchived ? '暂无归档会话' : '暂无会话'}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-3 border-t border-[#e9e9e5] px-1 pt-4 dark:border-[#32332e]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7e7e3] text-[11px] font-semibold text-[#85857f] dark:bg-[#30312d]">T</span>
        <button
          type="button"
          onClick={() => apiKeyConfigured ? void onLogout() : undefined}
          className="text-left"
          title={apiKeyConfigured ? '登出并删除已保存的 API Key' : '尚未保存 API Key'}
        >
          <span className="block text-[12px] font-medium">Teddy</span>
          <span className="block text-[9px] text-[#aaa9a4]">{apiKeyConfigured ? '登出' : '访客模式'}</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#8b8b85] hover:bg-white dark:hover:bg-[#30312d]"
          title={dark ? '切换浅色模式' : '切换深色模式'}
        >
          {dark ? '☀' : '◐'}
        </button>
      </div>
    </aside>
  );
}
