'use client';

import { AgentMark } from './agent-mark';

interface WelcomeDashboardProps {
  onNewChat: () => void;
  onFocusInput: () => void;
}

const FILE_TYPES = [
  { label: 'CSS', color: 'bg-[#fff0f4] text-[#ef6e91]' },
  { label: 'DOC', color: 'bg-[#edf5ff] text-[#6d91c4]' },
  { label: 'PPT', color: 'bg-[#fff6e7] text-[#d99a3f]' },
  { label: 'XLS', color: 'bg-[#eef9ef] text-[#55a965]' },
];

export function WelcomeDashboard({ onNewChat, onFocusInput }: WelcomeDashboardProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-9 pb-5">
      <div className="mx-auto flex min-h-full w-full max-w-[740px] flex-col items-center">
        <AgentMark className="h-[74px] w-[74px] drop-shadow-[0_8px_20px_rgba(101,212,94,0.2)]" />
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-[#202020]">
          你好 <span aria-hidden="true">👋</span> Teddy
        </h1>
        <p className="mt-1.5 text-center text-[12px] text-[#929292]">
          选择一个模型和项目目录，然后告诉我你想做什么。
        </p>

        <div className="mt-10 grid w-full grid-cols-3 gap-3.5">
          <button
            type="button"
            onClick={onNewChat}
            className="group relative min-h-[154px] overflow-hidden rounded-[18px] bg-[#202020] p-4 text-left text-white shadow-[0_8px_24px_rgba(25,25,25,0.12)] transition-transform hover:-translate-y-0.5"
          >
            <span className="inline-flex rounded-full bg-[#65d45e] px-2.5 py-1 text-[10px] font-semibold text-[#173915]">
              新建对话
            </span>
            <span className="mt-6 block text-[17px] font-semibold">开始新的想法</span>
            <span className="mt-1.5 block max-w-[150px] text-[11px] leading-5 text-white/55">
              选择工作目录，创建一个独立的任务空间。
            </span>
            <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-lg transition-colors group-hover:bg-white group-hover:text-black">
              ↗
            </span>
          </button>

          <button
            type="button"
            onClick={onFocusInput}
            className="group relative min-h-[154px] overflow-hidden rounded-[18px] bg-[linear-gradient(145deg,#143326,#4f8f68_50%,#c7e7bd)] p-4 text-left text-white shadow-[inset_0_0_40px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-0.5"
          >
            <div className="absolute -bottom-12 -right-8 h-40 w-40 rounded-full bg-[#dff2c4]/50 blur-xl" />
            <div className="absolute bottom-0 left-0 h-16 w-full bg-[linear-gradient(165deg,transparent_20%,#20482e_21%,#87b477_80%)] opacity-90" />
            <span className="relative inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#31583b]">
              创意工作
            </span>
            <span className="relative mt-6 block text-[17px] font-semibold">把灵感变成方案</span>
            <span className="relative mt-1.5 block text-[11px] leading-5 text-white/75">
              描述需求，让 Agent 开始执行。
            </span>
          </button>

          <button
            type="button"
            onClick={onFocusInput}
            className="group min-h-[154px] rounded-[18px] border border-[#e9e9e7] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(30,30,30,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f2] text-xl text-[#343434] transition-colors group-hover:bg-[#65d45e]">
              +
            </span>
            <span className="mt-6 block text-[17px] font-semibold text-[#242424]">发任务</span>
            <span className="mt-1.5 block text-[11px] leading-5 text-[#9a9a96]">
              输入清晰目标，任务会在后台持续运行。
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {FILE_TYPES.map((file) => (
            <button
              type="button"
              onClick={onFocusInput}
              key={file.label}
              className="flex h-8 items-center gap-2 rounded-full border border-[#ebebe8] bg-white px-3 text-[10px] text-[#777773] transition-colors hover:bg-[#f6f6f3]"
            >
              <span className={`flex h-5 min-w-7 items-center justify-center rounded-md px-1 text-[8px] font-bold ${file.color}`}>
                {file.label}
              </span>
              分析文件
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
