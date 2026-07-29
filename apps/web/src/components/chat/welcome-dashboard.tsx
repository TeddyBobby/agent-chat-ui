'use client';
/* eslint-disable @next/next/no-img-element -- Figma exports must render at their exact intrinsic geometry. */

import { AgentMark } from './agent-mark';

interface WelcomeDashboardProps {
  onNewChat: () => void;
  onFocusInput: () => void;
}

const FILES = [
  { asset: '/figma/file-css.svg', icon: '/figma/icon-css.svg', label: 'CSS 文件', width: 167 },
  { asset: '/figma/file-doc.svg', icon: '/figma/icon-ppt.svg', label: 'DOC 文件', width: 128 },
  { asset: '/figma/file-ppt.svg', icon: 'ppt', label: 'PPT 文件', width: 174 },
  { asset: '/figma/file-xsl.svg', icon: '/figma/icon-xsl.svg', label: 'XSL 文件', width: 170 },
];

export function WelcomeDashboard({ onNewChat, onFocusInput }: WelcomeDashboardProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="absolute left-1/2 top-[116px] -translate-x-1/2">
        <AgentMark className="h-[58px] w-[58px]" />
      </div>

      <div className="absolute left-1/2 top-[200px] -translate-x-1/2 text-center whitespace-nowrap">
        <h1 className="text-[22px] font-semibold leading-[29px] text-black">你好 <span className="text-[24px]">👋🏻</span> Teddy</h1>
        <p className="mt-[2px] text-[14px] font-normal leading-[29px] text-[#a9a9a9]">选择一个模型和项目目录，然后告诉我你想做什么。</p>
      </div>

      <div className="absolute left-1/2 top-[320px] grid h-[129px] w-[686px] origin-top -translate-x-1/2 grid-cols-[217px_229px_217px] gap-[12px] max-[900px]:scale-[0.72]">
        <button type="button" onClick={onNewChat} className="relative overflow-hidden rounded-[12px] bg-[#1a1a1a] text-left">
          <img className="absolute left-[16px] top-[12px] h-[26px] w-[26px]" src="/figma/card-mark.svg" alt="" />
          <span className="absolute right-[11px] top-[11px] flex h-[24px] w-[82px] items-center justify-center rounded-[20px] bg-[#32ce50] text-[12px] font-medium text-white">新建对话</span>
          <p className="absolute bottom-[13px] left-[9px] w-[197px] text-[9px] leading-[14px] text-white">
            点击「新建对话」浏览并选择代码目录。每个会话绑定独立工作区，互不干扰。
          </p>
        </button>

        <button type="button" onClick={onFocusInput} className="relative overflow-hidden rounded-[11px] text-left">
          <img className="absolute inset-0 h-full w-full object-cover" src="/figma/creative-card.png" alt="" />
          <div className="absolute bottom-0 left-0 h-[46px] w-full bg-black/60" />
          <span className="absolute bottom-[9px] left-[17px] text-[12px] font-medium leading-[29px] text-white">创意图像</span>
          <span className="absolute bottom-[9px] right-[9px] text-[10px] font-light leading-[29px] text-white">@OpenAI Image 2</span>
        </button>

        <button type="button" onClick={onFocusInput} className="relative rounded-[12px] border border-[#cacaca] bg-white text-left">
          <span className="absolute left-[14px] top-[4px] text-[12px] font-medium leading-[29px] text-[#0088ff]">发任务</span>
          <img className="absolute right-[10px] top-[8px] h-[23px] w-[23px]" src="/figma/icon-plus.svg" alt="" />
          <p className="absolute bottom-[13px] left-[14px] w-[197px] text-[9px] leading-[14px] text-[#727272]">
            告诉 AI 你的需求<br />修 Bug、加功能、重构代码。<br />流式输出实时反馈，工具调用全程可见。
          </p>
        </button>
      </div>

      <div className="absolute left-1/2 top-[484px] flex h-[44px] w-[688px] origin-top -translate-x-1/2 gap-[16px] max-[900px]:scale-[0.72]">
        {FILES.map((file) => (
          <button
            type="button"
            onClick={onFocusInput}
            key={file.asset}
            aria-label={`分析 ${file.label}`}
            style={{ width: file.width }}
            className="relative h-[44px] rounded-[40px] border border-[#dfdfdf] bg-white"
          >
            <img className="absolute left-[8px] top-[7px] h-[30px] w-[30px]" src={file.asset} alt="" />
            {file.icon === 'ppt' ? (
              <span className="absolute left-[20px] top-[13px] h-[17px] w-[16px]">
                <img className="absolute left-0 top-0 h-[10px] w-[14px]" src="/figma/vector-ppt-top.svg" alt="" />
                <img className="absolute bottom-0 left-0 h-[6px] w-[14px]" src="/figma/vector-ppt-bottom.svg" alt="" />
              </span>
            ) : (
              <img className="absolute left-[20px] top-[13px] h-[17px] w-[16px] object-contain" src={file.icon} alt="" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
