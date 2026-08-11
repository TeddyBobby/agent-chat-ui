'use client';
/* eslint-disable @next/next/no-img-element -- Figma exports must render at their exact intrinsic geometry. */

import React, { useState, useRef, useEffect } from 'react';
import { MODELS } from '@/lib/types';
import { API_URL } from '@/lib/api';
import { DirectoryPicker } from './directory-picker';
import {
  BINARY_ATTACHMENT_PLACEHOLDER,
  composeAttachmentMessage,
  isTextAttachment,
} from './attachment-message';

interface ChatInputProps {
  onSend: (content: string) => void;
  onModelChange: (modelId: string) => void;
  selectedModel: string;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  apiKeyConfigured: boolean;
  credentialSaving: boolean;
  credentialError?: string;
  onApiKeyCommit: () => Promise<void>;
  onLogout: () => Promise<void>;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  workdir: string;
  onWorkdirChange: (dir: string) => void;
  disabled: boolean;
  contextTokens?: number;
  contextLimit?: number;
  figmaPlacement?: boolean;
  draft?: { id: number; content: string };
}

interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

export function ChatInput({
  onSend, onModelChange, selectedModel, apiKey, onApiKeyChange,
  apiKeyConfigured, credentialSaving, credentialError, onApiKeyCommit, onLogout, baseUrl, onBaseUrlChange,
  workdir, onWorkdirChange, disabled, contextTokens = 0, contextLimit = 128000, figmaPlacement = false,
  draft,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean; endpoint: string; status: number; contentType: string;
    responsePreview: string; duration: number; diagnosis: string[];
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await onApiKeyCommit();
      const res = await fetch(`${API_URL}/v1/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, model: selectedModel }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        success: false, endpoint: '', status: 0, contentType: '',
        responsePreview: `请求失败: ${e.message}`, duration: 0,
        diagnosis: ['前端请求后端连接测试接口失败'],
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(
        figmaPlacement ? 94 : 0,
        Math.min(textareaRef.current.scrollHeight, 160),
      ) + 'px';
    }
  }, [input, figmaPlacement]);

  useEffect(() => {
    if (!draft) return;
    // A sidebar/welcome shortcut intentionally synchronizes its prompt into the composer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(draft.content);
    textareaRef.current?.focus();
  }, [draft]);

  const handleSubmit = () => {
    const hasContent = input.trim() || files.length > 0;
    if (!hasContent || disabled) return;

    const message = composeAttachmentMessage(
      input,
      files.map((file) => ({
        name: file.name,
        size: formatSize(file.size),
        content: file.content,
      })),
    );

    onSend(message);
    setInput('');
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles: AttachedFile[] = [];

    for (const file of selected) {
      if (!isTextAttachment(file.name, file.type)) {
        newFiles.push({
          name: file.name,
          content: BINARY_ATTACHMENT_PLACEHOLDER,
          size: file.size,
        });
        continue;
      }
      if (file.size > 500 * 1024) {
        newFiles.push({ name: file.name, content: `[文件过大: ${formatSize(file.size)}]`, size: file.size });
        continue;
      }
      try {
        const text = await file.text();
        newFiles.push({ name: file.name, content: text, size: file.size });
      } catch {
        newFiles.push({ name: file.name, content: '[无法读取]', size: file.size });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel);
  const ctxPct = contextLimit > 0 ? Math.min(100, Math.round((contextTokens / contextLimit) * 100)) : 0;
  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);

  return (
    <div
      className={figmaPlacement ? "absolute left-0 right-0 px-6" : "px-6 pb-6 pt-2"}
      style={figmaPlacement ? { top: 'min(626px, calc(100vh - 174px))' } : undefined}
    >
      <div className="mx-auto w-full max-w-[735px]">
        {/* Settings bar */}
        {showSettings && (
          <div className={`${figmaPlacement ? 'absolute bottom-[168px] left-6 right-6' : 'mb-3'} rounded-[18px] border border-[#e7e7e3] bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-900 animate-fade-in-up`}>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                模型
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[11px] text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors flex-1 min-w-0"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                密钥
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  onBlur={() => void onApiKeyCommit().catch(() => undefined)}
                  placeholder={apiKeyConfigured ? "已安全保存，输入可替换" : "sk-..."}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[11px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
                {apiKey.trim() && (
                  <button
                    type="button"
                    disabled={credentialSaving}
                    onClick={() => void onApiKeyCommit().catch(() => undefined)}
                    className="text-[10px] px-1.5 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {credentialSaving ? "保存中..." : "保存"}
                  </button>
                )}
                {apiKeyConfigured && (
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="text-[10px] px-1.5 py-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="登出并删除已保存的 API Key"
                  >
                    已保存 · 登出
                  </button>
                )}
              </label>
              <label className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                API 地址
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => onBaseUrlChange(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[11px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !baseUrl}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
              </label>
              <label className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                项目
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={workdir}
                    onChange={(e) => onWorkdirChange(e.target.value)}
                    placeholder="~/projects/my-app"
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[11px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                  />
                  <DirectoryPicker value={workdir} onChange={onWorkdirChange} />
                </div>
              </label>
            </div>
            {credentialError && (
              <div className="mt-2 text-[11px] text-red-500 dark:text-red-400">
                {credentialError}
              </div>
            )}
            {testResult && (
              <div className={`mt-2.5 p-2.5 rounded-lg text-[11px] leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {testResult.success ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  )}
                  <span className={`font-medium ${testResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                    {testResult.success ? '连接成功' : '连接失败'}
                  </span>
                  <span className="text-gray-400 dark:text-zinc-500 ml-auto">{testResult.duration}ms</span>
                </div>
                <div className="text-gray-500 dark:text-zinc-400 font-mono text-[10px] break-all mb-1.5">
                  {testResult.endpoint} → HTTP {testResult.status} ({testResult.contentType || '无'})
                </div>
                {testResult.diagnosis.length > 0 && (
                  <ul className="space-y-0.5">
                    {testResult.diagnosis.map((d, i) => (
                      <li key={i} className="text-gray-500 dark:text-zinc-400 flex gap-1">
                        <span className="text-gray-300 dark:text-zinc-600 flex-shrink-0">{i + 1}.</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attached files */}
        {files.length > 0 && (
          <div className={`${figmaPlacement ? 'absolute bottom-[168px] left-6 right-6' : 'mb-2'} flex flex-wrap gap-1.5`}>
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-300 font-mono">
                {f.name} ({formatSize(f.size)})
                <button onClick={() => removeFile(i)} className="hover:text-red-500 transition-colors ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Context bar */}
        {contextTokens > 0 && !figmaPlacement && (
          <div className="mb-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ctxPct > 80 ? 'bg-red-400' : ctxPct > 50 ? 'bg-amber-400' : 'bg-indigo-400/60'
                }`}
                style={{ width: `${Math.max(ctxPct, 2)}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono flex-shrink-0 ${
              ctxPct > 80 ? 'text-red-400' : ctxPct > 50 ? 'text-amber-500' : 'text-gray-400 dark:text-zinc-500'
            }`}>
              {ctxPct}% · {fmt(contextTokens)} / {fmt(contextLimit)}
            </span>
          </div>
        )}

        {/* Composer */}
        <div className={`rounded-[22px] border border-[#cacaca] bg-white px-[10px] pb-[10px] pt-[13px] shadow-[0_0_13px_2px_rgba(209,211,212,0.23)] transition-all focus-within:border-[#a8a8a8] dark:border-zinc-700 dark:bg-zinc-900 ${figmaPlacement ? 'h-[160px]' : ''}`}>
          <input
            ref={fileInputRef}
            id="agent-chat-file-input"
            type="file"
            multiple
            onChange={handleFilePick}
            className="hidden"
            aria-label="选择文件附件"
            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.yaml,.yml,.toml,.xml,.csv,.env,.gitignore,.sh,.bash,.zsh,.sql,.graphql,.prisma,.rs,.go,.java,.c,.cpp,.h,.rb,.php,.swift,.kt,.dart,.vue,.svelte,.cfg,.conf,.ini,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.zip,.rar,.7z,.tar,.gz"
          />
          <textarea
            ref={textareaRef}
            id="agent-chat-composer"
            aria-label="输入消息"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={workdir
              ? `${workdir.split('/').pop()} 项目中，输入消息，@引用文件，$引用 Skills...`
              : figmaPlacement
                ? '输入消息，@引用文件，$引用Skills，提示词可队列发送…'
                : '输入消息，@引用文件，$引用 Skills，描述你想完成的任务...'}
            disabled={disabled}
            rows={3}
            className={`block w-full resize-none bg-transparent px-[10px] text-[14px] leading-[22px] text-[#33332f] placeholder-[#a9a9a9] focus:outline-none disabled:opacity-40 dark:text-zinc-200 dark:placeholder-zinc-600 ${figmaPlacement ? 'h-[94px]' : 'min-h-[76px]'}`}
          />

          <div className="mt-[3px] flex items-center gap-[8px]">
            <button
              onClick={() => setShowSettings(!showSettings)}
              aria-label={showSettings ? "关闭设置面板" : "打开设置面板"}
              className={`flex h-[30px] min-w-[157px] flex-shrink-0 items-center rounded-[30px] border border-[#cacaca] px-[8px] text-[11px] font-medium text-[#898989] shadow-[0_0_13px_2px_rgba(209,211,212,0.23)] transition-all ${
                showSettings
                  ? 'bg-[#f5f5f5]'
                  : 'bg-white hover:bg-[#f7f7f7] dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              <img className="mr-[6px] h-[17px] w-[17px]" src="/figma/icon-claude.svg" alt="" />
              <span className="max-w-[106px] truncate">{selectedModelInfo?.name || selectedModel}</span>
              <img className="ml-auto h-[5px] w-[9px]" src="/figma/caret-down.svg" alt="" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="添加文件"
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[30px] border border-[#cacaca] bg-white shadow-[0_0_13px_2px_rgba(209,211,212,0.23)] transition-colors hover:bg-[#f7f7f7] disabled:opacity-20 dark:bg-zinc-800"
              title="添加文件"
            >
              <img className="h-[13px] w-[13px]" src="/figma/icon-attachment.svg" alt="" />
            </button>
            {baseUrl && (
              <span
                onClick={() => setShowSettings(!showSettings)}
                className="max-w-[120px] cursor-pointer truncate rounded-full bg-[#eff8ee] px-2 py-1 text-[9px] font-medium text-[#579653] dark:bg-emerald-500/10 dark:text-emerald-300"
                title={`代理: ${baseUrl}`}
              >
                {extractDomain(baseUrl)}
              </span>
            )}

            <button
              onClick={handleSubmit}
              disabled={disabled || (!input.trim() && files.length === 0)}
              aria-label="发送消息"
              className="ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-[30px] bg-[#ececed] transition-all hover:bg-[#dedede] disabled:cursor-not-allowed dark:disabled:bg-zinc-800"
              title="发送"
            >
              <img className="h-[10px] w-[11px] -rotate-90" src="/figma/arrow-up.svg" alt="" />
            </button>
          </div>
        </div>

        {!figmaPlacement && (
          <p className="mt-2 text-center text-[9px] text-[#b3b3ae] dark:text-zinc-600">
            回车发送 · Shift + 回车换行 · 任务会在后台持续运行
          </p>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split('/')[0] || url;
  }
}
