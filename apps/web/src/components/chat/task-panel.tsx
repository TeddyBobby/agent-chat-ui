'use client';

import type { Conversation } from '@/lib/types';
import { AgentMark } from './agent-mark';

interface TaskPanelProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function TaskPanel({ conversations, activeId, onSelect }: TaskPanelProps) {
  const running = conversations.filter((conversation) => conversation.activeRun);
  const recent = conversations.filter((conversation) => !conversation.archived).slice(0, 4);

  return (
    <aside className="hidden h-full w-[318px] flex-shrink-0 flex-col border-l border-[#ededeb] bg-white p-6 min-[1120px]:flex">
      <div className="relative min-h-[216px] overflow-hidden rounded-[20px] bg-[#f5f6f3] p-5">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#dff4dc]" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white" />
        <AgentMark className="absolute right-5 top-5 h-14 w-14 rotate-6 opacity-90" compact />
        <div className="relative flex h-full flex-col justify-end">
          <span className="text-[11px] font-medium text-[#65a961]">MOAgent workspace</span>
          <h2 className="mt-1 max-w-[190px] text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[#202020]">
            刷新页面，任务仍会继续
          </h2>
          <p className="mt-2 max-w-[210px] text-[11px] leading-5 text-[#8e8f89]">
            页面重连会恢复进行中的任务；重启应用后仍会保留历史消息。
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#242424]">任务动态</h3>
        {running.length > 0 && (
          <span className="rounded-full bg-[#eaf8e8] px-2 py-0.5 text-[9px] font-semibold text-[#4b9c49]">
            {running.length} 进行中
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#dededb] px-4 py-8 text-center">
            <p className="text-[12px] font-medium text-[#777773]">还没有任务</p>
            <p className="mt-1 text-[10px] leading-4 text-[#aaa9a4]">创建对话后，运行状态会显示在这里。</p>
          </div>
        ) : (
          recent.map((conversation) => {
            const isRunning = Boolean(conversation.activeRun);
            const isActive = conversation.id === activeId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`w-full rounded-[14px] border p-3 text-left transition-colors ${
                  isActive ? 'border-[#bce8b8] bg-[#f4fbf3]' : 'border-[#eeeeeb] bg-white hover:bg-[#fafaf8]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isRunning ? 'animate-pulse bg-[#65d45e]' : 'bg-[#d5d5d1]'}`} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#484844]">
                    {conversation.title || '新对话'}
                  </span>
                  <span className="text-[9px] text-[#a1a19c]">{isRunning ? '运行中' : '已保存'}</span>
                </div>
                {conversation.workdir && (
                  <p className="mt-2 truncate pl-4 text-[9px] text-[#aaa9a4]">{conversation.workdir}</p>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
