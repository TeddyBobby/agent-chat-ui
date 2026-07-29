'use client';
/* eslint-disable @next/next/no-img-element -- Figma exports must render at their exact intrinsic geometry. */

import { useEffect, useState } from 'react';
import { API_URL, workspaceApi } from '@/lib/api';
import type { Conversation } from '@/lib/types';
import { visibleMessageText } from './attachment-message';

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
  workdir: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onHome: () => void;
  onChooseWorkspace: () => void;
  onUsePrompt: (prompt: string) => void;
}

const FIGMA_ICON = {
  skills: '/figma/icon-new-chat.svg',
  mcp: '/figma/icon-mcp.svg',
  newChat: '/figma/icon-skill.svg',
  workspace: '/figma/icon-workspace.svg',
  recent: '/figma/icon-recent.svg',
};

export function Sidebar({
  conversations, activeId, runningConvIds, onSelect, onArchive, onRestore, onDelete,
  onNewChat, onLogout, apiKeyConfigured, workdir, collapsed, onCollapsedChange,
  onHome, onChooseWorkspace,
  onUsePrompt,
}: SidebarProps) {
  const [section, setSection] = useState<'none' | 'recent' | 'archived'>('none');
  const [utility, setUtility] = useState<'skills' | 'mcp' | 'workspace' | null>(null);
  const activeConversations = conversations.filter((conversation) => !conversation.archived);
  const archivedConversations = conversations.filter((conversation) => conversation.archived);
  const visibleConversations = section === 'archived' ? archivedConversations : activeConversations;

  if (collapsed) {
    return (
      <aside className="relative h-full w-[68px] flex-shrink-0 bg-[#f5f5f5] transition-[width]">
        <button type="button" onClick={onHome} className="absolute left-[20px] top-[32px]" aria-label="返回欢迎页">
          <img className="h-[27px] w-[27px]" src="/figma/sidebar-accent.svg" alt="" />
        </button>
        <button type="button" onClick={() => onCollapsedChange(false)} className="absolute left-[24px] top-[76px]" aria-label="展开侧栏">
          <img className="h-5 w-5 rotate-180" src="/figma/icon-sidebar-toggle.svg" alt="" />
        </button>
        <div className="absolute left-[13px] top-[116px] flex w-[42px] flex-col items-center gap-2 rounded-[14px] bg-white py-2">
          <CompactButton icon={FIGMA_ICON.skills} label="Skills" onClick={() => {
            setUtility('skills');
            onCollapsedChange(false);
          }} />
          <CompactButton icon={FIGMA_ICON.mcp} label="MCP" onClick={() => {
            setUtility('mcp');
            onCollapsedChange(false);
          }} />
          <CompactButton icon={FIGMA_ICON.newChat} label="新对话" onClick={onNewChat} />
        </div>
        <button type="button" onClick={() => apiKeyConfigured ? void onLogout() : undefined} className="absolute bottom-[32px] left-[19px]" aria-label="登出">
          <img className="h-[30px] w-[30px]" src="/figma/avatar.svg" alt="" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative h-full w-[284px] flex-shrink-0 overflow-hidden bg-[#f5f5f5] text-[#5e5e5e] transition-[width]">
      <button type="button" onClick={onHome} className="absolute left-[27px] top-[32px] h-[27px] w-[136px]" aria-label="返回欢迎页">
        <img className="absolute left-0 top-0 h-[27px] w-[27px]" src="/figma/sidebar-accent.svg" alt="" />
        <img className="absolute left-[38px] top-[4px] h-[17.591px] w-[37.117px]" src="/figma/logo-mark.svg" alt="" />
        <img className="absolute left-[78px] top-[5px] h-[21.15px] w-[57.548px]" src="/figma/logo-wordmark.svg" alt="" />
      </button>
      <button type="button" onClick={() => onCollapsedChange(true)} className="absolute left-[244px] top-[35px]" aria-label="收起侧栏">
        <img className="h-5 w-5" src="/figma/icon-sidebar-toggle.svg" alt="" />
      </button>

      <nav className="absolute left-[27px] top-[108px] h-[172px] w-[237px] rounded-[16px] bg-white px-[25px] py-[10px]">
        <button type="button" onClick={() => setUtility((current) => current === 'skills' ? null : 'skills')} className="flex h-[47px] w-full items-center gap-[12px] text-[14px] font-medium">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.skills} alt="" />
          Skills
        </button>
        <button type="button" onClick={() => setUtility((current) => current === 'mcp' ? null : 'mcp')} className="flex h-[47px] w-full items-center gap-[12px] text-[14px] font-medium">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.mcp} alt="" />
          MCP
        </button>
        <button type="button" onClick={onNewChat} className="flex h-[47px] w-full items-center gap-[12px] text-[14px] font-medium">
          <img className="h-[16px] w-[16px]" src={FIGMA_ICON.newChat} alt="" />
          新对话
        </button>
      </nav>

      <div className="absolute left-[53px] right-[30px] top-[316px]">
        <button type="button" onClick={() => setUtility((current) => current === 'workspace' ? null : 'workspace')} className="flex h-[47px] w-full items-center text-[12px] text-[#848383]">
          <img className="mr-[13px] h-[14px] w-[14px]" src={FIGMA_ICON.workspace} alt="" />
          工作空间
          <img className="ml-[13px] h-[5px] w-[9px] -rotate-90" src="/figma/caret-down.svg" alt="" />
        </button>
        <button
          type="button"
          onClick={() => setSection((current) => current === 'recent' ? 'none' : 'recent')}
          className="flex h-[47px] w-full items-center text-[12px] text-[#848383]"
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
              const title = visibleMessageText(conversation.title) || '新对话';
              return (
                <div key={conversation.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-[11px] ${active ? 'bg-white' : 'hover:bg-white/70'}`}>
                  <button type="button" onClick={() => onSelect(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#32ce50]' : 'bg-[#cfcfcf]'}`} />
                    <span className="truncate">{title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => section === 'archived' ? onRestore(conversation.id) : onArchive(conversation.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`${section === 'archived' ? '恢复' : '归档'}会话 ${title}`}
                    title={section === 'archived' ? '恢复会话' : '归档会话'}
                  >
                    {section === 'archived' ? '↩' : '…'}
                  </button>
                  {section === 'archived' && (
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={`永久删除会话 ${title}`}
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

      {utility && (
        <UtilityPanel
          key={`${utility}-${workdir}`}
          mode={utility}
          workdir={workdir}
          onClose={() => setUtility(null)}
          onChooseWorkspace={onChooseWorkspace}
          onUsePrompt={onUsePrompt}
        />
      )}

      <button
        type="button"
        onClick={() => apiKeyConfigured ? void onLogout() : undefined}
        disabled={!apiKeyConfigured}
        className="absolute bottom-[32px] left-[30px] right-[20px] flex h-[30px] items-center text-[#5e5e5e] disabled:cursor-default"
        title={apiKeyConfigured ? '登出并删除已保存的 API Key' : '尚未保存 API Key'}
      >
        <img className="h-[30px] w-[30px]" src="/figma/avatar.svg" alt="" />
        <span className="ml-[10px] text-[12px] font-medium">登出</span>
        <img className="ml-auto h-[18px] w-[18px]" src="/figma/icon-logout.svg" alt="" />
      </button>
    </aside>
  );
}

function CompactButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f4f4f4]" aria-label={label} title={label}>
      <img className="h-4 w-4" src={icon} alt="" />
    </button>
  );
}

function UtilityPanel({
  mode, workdir, onClose, onChooseWorkspace, onUsePrompt,
}: {
  mode: 'skills' | 'mcp' | 'workspace';
  workdir: string;
  onClose: () => void;
  onChooseWorkspace: () => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [filesystemAvailable, setFilesystemAvailable] = useState<boolean | null>(null);
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode !== 'mcp') return;
    const controller = new AbortController();
    let active = true;
    void Promise.allSettled([
      fetch(`${API_URL}/health`, { signal: controller.signal }).then((response) => response.ok),
      workdir ? workspaceApi.tree(workdir).then(() => true) : Promise.resolve(false),
      workdir ? workspaceApi.review(workdir).then((review) => review.isGitRepository) : Promise.resolve(false),
    ]).then(([api, filesystem, git]) => {
      if (!active) return;
      setApiOnline(api.status === 'fulfilled' && api.value);
      setFilesystemAvailable(filesystem.status === 'fulfilled' && filesystem.value);
      setGitAvailable(git.status === 'fulfilled' && git.value);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [mode, workdir]);

  const skillPrompts = [
    ['读取与分析文件', '请读取并分析当前项目中与需求相关的文件，先总结现状和关键依赖。'],
    ['编辑与创建代码', '请根据我的下一条需求编辑或创建代码，并在完成后运行必要的验证。'],
    ['搜索项目内容', '请在当前项目中搜索与我的下一条问题相关的实现，并列出关键文件和调用关系。'],
    ['运行构建与测试', '请运行当前项目适用的类型检查、测试和构建，并修复发现的问题。'],
  ] as const;
  return (
    <div className="absolute left-[27px] top-[292px] z-20 w-[237px] rounded-[14px] border border-[#e4e4e4] bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#555]">
          {mode === 'skills' ? '可用 Skills' : mode === 'mcp' ? 'MCP 连接' : '当前工作空间'}
        </p>
        <button type="button" onClick={onClose} className="text-[14px] text-[#aaa]" aria-label="关闭">×</button>
      </div>
      {mode === 'skills' && (
        <div className="mt-2 space-y-1">
          {skillPrompts.map(([skill, prompt]) => (
            <button
              type="button"
              key={skill}
              onClick={() => {
                onUsePrompt(prompt);
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded-lg bg-[#f8f8f7] px-2.5 py-2 text-left text-[10px] text-[#666] hover:bg-[#efefed]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#32ce50]" />{skill}
            </button>
          ))}
        </div>
      )}
      {mode === 'mcp' && (
        <div className="mt-2 space-y-1.5">
          <p className="mb-2 text-[8px] leading-3 text-[#aaa]">当前版本使用内置本地集成；这里展示实际可用状态。</p>
          {([
            ['本地 Agent API', apiOnline === null ? '检测中' : apiOnline ? '在线' : '离线', apiOnline],
            ['工作区文件系统', filesystemAvailable === null ? '检测中' : filesystemAvailable ? '可用' : workdir ? '不可读' : '待选择', filesystemAvailable],
            ['Git 代码审查', gitAvailable === null ? '检测中' : gitAvailable ? '可检查' : workdir ? '非 Git 仓库' : '待选择', gitAvailable],
          ] as Array<[string, string, boolean | null]>).map(([service, status, available]) => (
            <div key={service} className="flex items-center rounded-lg border border-[#ededed] px-2.5 py-2 text-[10px] text-[#666]">
              <span className={`mr-2 h-1.5 w-1.5 rounded-full ${available ? 'bg-[#32ce50]' : 'bg-[#c8c8c8]'}`} />
              <span className="flex-1">{service}</span>
              <span className="text-[8px] text-[#999]">{status}</span>
            </div>
          ))}
        </div>
      )}
      {mode === 'workspace' && (
        <div className="mt-2">
          <div className="rounded-lg bg-[#f8f8f7] p-2.5">
            <p className="truncate text-[10px] font-medium text-[#555]">{workdir ? workdir.split('/').pop() : '未选择目录'}</p>
            <p className="mt-1 break-all text-[8px] leading-3 text-[#999]">{workdir || '新建对话时选择一个项目目录。'}</p>
          </div>
          <button type="button" onClick={onChooseWorkspace} className="mt-2 h-8 w-full rounded-lg bg-[#1a1a1a] text-[10px] font-medium text-white">
            {workdir ? '更换目录' : '选择目录'}
          </button>
        </div>
      )}
    </div>
  );
}
