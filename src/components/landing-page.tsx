'use client';

import { MODELS } from '@/lib/types';

interface LandingPageProps {
  onNewChat: () => void;
  onSelectModel: () => void;
}

export function LandingPage({ onNewChat, onSelectModel }: LandingPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto">
      <div className="max-w-2xl w-full px-8 py-12 animate-fade-in-up">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2 tracking-tight">
            {'{{Pi}}'}Agent
          </h1>
          <p className="text-[14px] text-gray-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            AI 编程助手 —— 对话式操作文件系统，读代码、写文件、执行命令，让 AI 直接在项目里工作
          </p>
        </div>

        {/* Quick start */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider text-center mb-5">
            快速开始
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Step 1 */}
            <button
              onClick={onNewChat}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md hover:shadow-indigo-500/5 transition-all text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-indigo-500">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">选择项目</div>
                <div className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">打开你的代码目录</div>
              </div>
            </button>

            {/* Step 2 */}
            <button
              onClick={onSelectModel}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md hover:shadow-indigo-500/5 transition-all text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-indigo-500">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">配置模型</div>
                <div className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">选择 LLM 和 API Key</div>
              </div>
            </button>

            {/* Step 3 */}
            <div className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-indigo-500">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">开始对话</div>
                <div className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">在下方输入框发送任务</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div>
          <h2 className="text-[13px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider text-center mb-4">
            能力
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '📖', title: '读写文件', desc: '读取、创建、编辑项目中的任意文件' },
              { icon: '🔍', title: '搜索代码', desc: '正则搜索代码库，快速定位' },
              { icon: '⚡', title: '执行命令', desc: '运行 shell 命令、安装依赖、启动服务' },
              { icon: '🔄', title: '多会话', desc: '同时处理多个项目，互不干扰' },
              { icon: '💬', title: '流式输出', desc: '逐 token 实时渲染，即时反馈' },
              { icon: '📦', title: '归档管理', desc: '归档历史对话，随时恢复' },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <span className="text-base flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <div className="text-[13px] font-medium text-gray-700 dark:text-zinc-300">{f.title}</div>
                  <div className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 dark:text-zinc-600 mt-8">
          输入框在页面底部，Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
