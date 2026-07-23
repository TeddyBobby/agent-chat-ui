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
  workdir: string;
  onWorkdirChange: (dir: string) => void;
  disabled: boolean;
}

interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

export function ChatInput({
  onSend, onModelChange, selectedModel, apiKey, onApiKeyChange,
  workdir, onWorkdirChange, disabled,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Skip binary/large files
      if (file.size > 500 * 1024) {
        newFiles.push({ name: file.name, content: `[File too large: ${formatSize(file.size)}]`, size: file.size });
        continue;
      }
      try {
        const text = await file.text();
        newFiles.push({ name: file.name, content: text, size: file.size });
      } catch {
        newFiles.push({ name: file.name, content: '[Cannot read file]', size: file.size });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel);

  return (
    <div className="px-4 sm:px-8 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* Settings bar */}
        {showSettings && (
          <div className="mb-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 animate-fade-in-up">
            <div className="flex gap-3 items-center flex-wrap">
              <label className="text-[12px] font-medium text-zinc-400 flex items-center gap-2">
                Model
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-[12px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-zinc-400 flex items-center gap-2">
                Key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-[12px] text-zinc-200 w-40 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
              </label>
            </div>
            <div className="flex gap-2 items-center mt-2.5">
              <label className="text-[12px] font-medium text-zinc-400 flex items-center gap-2 flex-1">
                Project
                <div className="flex gap-1.5 flex-1">
                  <input
                    type="text"
                    value={workdir}
                    onChange={(e) => onWorkdirChange(e.target.value)}
                    placeholder="~/projects/my-app"
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-[12px] text-zinc-200 flex-1 min-w-0 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                  />
                  <DirectoryPicker value={workdir} onChange={onWorkdirChange} />
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Attached files */}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-mono">
                {f.name} ({formatSize(f.size)})
                <button onClick={() => removeFile(i)} className="hover:text-red-400 transition-colors ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-end bg-zinc-900 rounded-2xl border border-zinc-800 focus-within:border-indigo-500/30 focus-within:shadow-lg focus-within:shadow-indigo-500/5 transition-all px-4 py-2.5">
          {/* File attach */}
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
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition-colors flex-shrink-0"
            title="Attach files"
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
            placeholder={workdir ? `Working in ${workdir.split('/').pop()}...` : 'Tell {{Pi}}Agent what to do...'}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed focus:outline-none disabled:opacity-40 placeholder-zinc-600 text-zinc-200"
          />

          <div className="flex items-center gap-1.5">
            {/* Model badge */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition-all flex-shrink-0 ${
                showSettings
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700'
              }`}
            >
              {selectedModelInfo?.name || selectedModel}
            </button>

            {/* Send */}
            <button
              onClick={handleSubmit}
              disabled={disabled || (!input.trim() && files.length === 0)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[11px] text-zinc-600 text-center mt-2">
          Enter to send · Shift+Enter for new line · 📎 to attach files
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
