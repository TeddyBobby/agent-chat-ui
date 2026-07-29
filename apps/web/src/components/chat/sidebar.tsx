'use client';
/* eslint-disable @next/next/no-img-element -- Figma exports must render at their exact intrinsic geometry. */

import { useState } from 'react';
import type { Conversation } from '@/lib/types';

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

const FIGMA_ICON = {
  skills: '/figma/icon-skill.svg',
  mcp: '/figma/icon-mcp.svg',
  newChat: '/figma/icon-new-chat.svg',
  workspace: '/figma/icon-workspace.svg',
  recent: '/figma/icon-recent.svg',
};

export function Sidebar({
  conversations, activeId, runningConvIds, onSelect, onArchive, onRestore, onDelete,
  onNewChat, onLogout, apiKeyConfigured,
}: SidebarProps) {
  const [section, setSection] = useState<'none' | 'recent' | 'archived'>('none');
  const activeConversations = conversations.filter((conversation) => !conversation.archived);
  const archivedConversations = conversations.filter((conversation) => conversation.archived);
  const visibleConversations = section === 'archived' ? archivedConversations : activeConversations;

  return (
    <aside className="relative h-full w-[284px] flex-shrink-0 overflow-hidden bg-[#f5f5f5] text-[#5e5e5e]">
      <div className="absolute left-[27px] top-[32px] flex h-[27px] items-center">
        <img className="h-[27px] w-[27px]" src="/figma/sidebar-accent.svg" alt="" />
        <img className="ml-[11px] h-[18px] w-[37px]" src="/figma/logo-mark.svg" alt="MO" />
        <img className="ml-[3px] h-[21px] w-[58px]" src="/figma/logo-wordmark.svg" alt="Agent" />
      </div>
      <img className="absolute left-[244px] top-[35px] h-5 w-5" src="/figma/icon-sidebar-toggle.svg" alt="" />

      <nav className="absolute left-[27px] top-[108px] h-[172px] w-[237px] rounded-[16px] bg-white px-[25px] py-[10px]">
        <button type="button" disabled title="Skills 管理即将开放" className="flex h-[47px] w-full cursor-not-allowed items-center gap-[14px] text-[16px] font-medium opacity-70">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.skills} alt="" />
          Skills
        </button>
        <button type="button" disabled title="MCP 管理即将开放" className="flex h-[47px] w-full cursor-not-allowed items-center gap-[14px] text-[16px] font-medium opacity-70">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.mcp} alt="" />
          MCP
        </button>
        <button type="button" onClick={onNewChat} className="flex h-[47px] w-full items-center gap-[14px] text-[16px] font-medium">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.newChat} alt="" />
          新对话
        </button>
      </nav>

      <div className="absolute left-[53px] right-[30px] top-[316px]">
        <button type="button" className="flex h-[47px] w-full items-center text-[14px] text-[#848383]">
          <img className="mr-[13px] h-[14px] w-[14px]" src={FIGMA_ICON.workspace} alt="" />
          工作空间
          <img className="ml-[13px] h-[5px] w-[9px] -rotate-90" src="/figma/caret-down.svg" alt="" />
        </button>
        <button
          type="button"
          onClick={() => setSection((current) => current === 'recent' ? 'none' : 'recent')}
          className="flex h-[47px] w-full items-center text-[14px] text-[#848383]"
        >
          <img className="mr-[13px] h-[13px] w-[13px]" src={FIGMA_ICON.recent} alt="" />
          最近会话
          <img className={`ml-[13px] h-[5px] w-[9px] transition-transform ${section === 'recent' ? '' : '-rotate-90'}`} src="/figma/caret-down.svg" alt="" />
          {activeConversations.length > 0 && (
            <span className="ml-[12px] flex h-[15px] min-w-[22px] items-center justify-center rounded-[8px] bg-[#32ce50] px-1 text-[10px] font-medium text-white">
              {activeConversations.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSection((current) => current === 'archived' ? 'none' : 'archived')}
          className="ml-[27px] mt-1 text-[10px] text-[#aaa]"
        >
          {section === 'archived' ? '收起归档' : '查看归档'}
        </button>

        {section !== 'none' && (
          <div
            className="mt-2 space-y-1 overflow-y-auto pr-1"
            style={{ maxHeight: 'min(240px, calc(73vh - 430px))' }}
          >
            {visibleConversations.map((conversation) => {
              const active = conversation.id === activeId;
              const running = runningConvIds.has(conversation.id);
              return (
                <div key={conversation.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-[11px] ${active ? 'bg-white' : 'hover:bg-white/70'}`}>
                  <button type="button" onClick={() => onSelect(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#32ce50]' : 'bg-[#cfcfcf]'}`} />
                    <span className="truncate">{conversation.title || '新对话'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => section === 'archived' ? onRestore(conversation.id) : onArchive(conversation.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`${section === 'archived' ? '恢复' : '归档'}会话 ${conversation.title || '新对话'}`}
                    title={section === 'archived' ? '恢复会话' : '归档会话'}
                  >
                    {section === 'archived' ? '↩' : '…'}
                  </button>
                  {section === 'archived' && (
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={`永久删除会话 ${conversation.title || '新对话'}`}
                      title="永久删除会话"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute left-[30px] top-[73%] flex h-[30px] items-center">
        <img className="h-[30px] w-[30px]" src="/figma/avatar.svg" alt="" />
        <button
          type="button"
          onClick={() => apiKeyConfigured ? void onLogout() : undefined}
          className="ml-[10px] text-[14px] font-medium text-[#5e5e5e]"
          title={apiKeyConfigured ? '登出并删除已保存的 API Key' : '尚未保存 API Key'}
        >
          登出
        </button>
      </div>
      <img className="absolute left-[244px] top-[73%] mt-[6px] h-[18px] w-[18px]" src="/figma/icon-logout.svg" alt="" />
    </aside>
  );
}
