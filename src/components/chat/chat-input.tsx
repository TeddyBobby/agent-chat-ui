'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MODELS } from '@/lib/types';
import { DirectoryPicker } from './directory-picker';

interface ChatInputProps {
  onSend: (content: string) => void;
  onModelChange: (modelId: string) => void;
  selectedModel: string;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  workdir: string;
  onWorkdirChange: (dir: string) => void;
  disabled: boolean;
  contextTokens?: number;
  contextLimit?: number;
}

interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

export function ChatInput({
  onSend, onModelChange, selectedModel, apiKey, onApiKeyChange,
  baseUrl, onBaseUrlChange, workdir, onWorkdirChange, disabled, contextTokens = 0, contextLimit = 128000,
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
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, model: selectedModel }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        success: false, endpoint: '', status: 0, contentType: '',
        responsePreview: `请求失败: ${e.message}`, duration: 0,
        diagnosis: ['前端请求 /api/test-connection 失败'],
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    const hasContent = input.trim() || files.length > 0;
    if (!hasContent || disabled) return;

    let message = input.trim();
    if (files.length > 0) {
      const fileBlocks = files.map(f =>
        `\n\n<!-- file: ${f.name} (${formatSize(f.size)}) -->\n\`\`\`\n${f.content}\n\`\`\``
      ).join('');
      message = (message || `Attached ${files.length} file(s)`) + fileBlocks;
    }

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
    <div className="px-8 pb-4 pt-2">
      <div>
        {/* Settings bar */}
        {showSettings && (
          <div className="mb-3 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 animate-fade-in-up">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                模型
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[12px] text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors flex-1 min-w-0"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                密钥
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[12px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
              </label>
              <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                API 地址
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => onBaseUrlChange(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[12px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
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
              <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                项目
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={workdir}
                    onChange={(e) => onWorkdirChange(e.target.value)}
                    placeholder="~/projects/my-app"
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[12px] text-gray-800 dark:text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                  />
                  <DirectoryPicker value={workdir} onChange={onWorkdirChange} />
                </div>
              </label>
            </div>
            {testResult && (
              <div className={`mt-2.5 p-2.5 rounded-lg text-[11px] leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={testResult.success ? 'text-emerald-600' : 'text-red-500'}>
                    {testResult.success ? '✅' : '❌'}
                  </span>
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
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-300 font-mono">
                {f.name} ({formatSize(f.size)})
                <button onClick={() => removeFile(i)} className="hover:text-red-500 transition-colors ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Context bar */}
        {contextTokens > 0 && (
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

        {/* Input row */}
        <div className="flex gap-2 items-end bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 focus-within:border-indigo-500/30 focus-within:shadow-lg focus-within:shadow-indigo-500/5 transition-all px-4 py-2.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilePick}
            className="hidden"
            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.yaml,.yml,.toml,.xml,.csv,.env,.gitignore,.sh,.bash,.zsh,.sql,.graphql,.prisma,.rs,.go,.java,.c,.cpp,.h,.rb,.php,.swift,.kt,.dart,.vue,.svelte,.cfg,.conf,.ini,.log"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 disabled:opacity-20 transition-colors flex-shrink-0"
            title="添加文件"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={workdir ? `${workdir.split('/').pop()} 项目中...` : '告诉 {{Pi}}Agent 做什么...'}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed focus:outline-none disabled:opacity-40 placeholder-gray-400 dark:placeholder-zinc-600 text-gray-800 dark:text-zinc-200"
          />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition-all flex-shrink-0 ${
                showSettings
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-transparent hover:border-gray-300 dark:hover:border-zinc-700'
              }`}
            >
              {selectedModelInfo?.name || selectedModel}
            </button>
            {baseUrl && (
              <span
                onClick={() => setShowSettings(!showSettings)}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-medium cursor-pointer flex-shrink-0 max-w-[120px] truncate"
                title={`代理: ${baseUrl}`}
              >
                🔗 {extractDomain(baseUrl)}
              </span>
            )}

            <button
              onClick={handleSubmit}
              disabled={disabled || (!input.trim() && files.length === 0)}
              className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[11px] text-gray-400 dark:text-zinc-600 text-center mt-2">
          回车发送 · Shift+回车换行 · 📎 添加文件
        </p>
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
