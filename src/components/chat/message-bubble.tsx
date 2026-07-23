'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/types';
import { ToolCallCard } from './tool-call-card';

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
}

interface ParsedFile {
  name: string;
  size: string;
  content: string;
}

function parseFiles(content: string): { files: ParsedFile[]; cleanContent: string } {
  const files: ParsedFile[] = [];
  const regex = /<!--\s*file:\s*(.+?)\s*\((.+?)\)\s*-->\s*\n```[\w]*\n([\s\S]*?)```/g;
  let clean = content;
  let match;

  while ((match = regex.exec(content)) !== null) {
    files.push({ name: match[1].trim(), size: match[2].trim(), content: match[3] });
    clean = clean.replace(match[0], '');
  }

  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return { files, cleanContent: clean };
}

const FILE_ICONS: Record<string, string> = {
  ts: 'TS', tsx: 'TS', js: 'JS', jsx: 'JS', json: '{}',
  md: 'MD', css: '#', html: '<>', py: 'PY', yaml: 'Y',
  yml: 'Y', toml: 'T', sh: '$>', bash: '$>', sql: 'DB',
  rs: 'RS', go: 'GO', java: 'JV', vue: 'V', svg: 'SVG',
};

const PREVIEWABLE = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'html', 'htm',
  'py', 'yaml', 'yml', 'toml', 'sh', 'bash', 'zsh', 'sql',
  'graphql', 'prisma', 'rs', 'go', 'java', 'c', 'cpp', 'h',
  'rb', 'php', 'swift', 'kt', 'dart', 'vue', 'svelte',
  'cfg', 'conf', 'ini', 'log', 'txt', 'env', 'gitignore',
  'xml', 'csv', 'svg', 'scss', 'less',
]);

function getFileMeta(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return {
    icon: FILE_ICONS[ext] || ext.toUpperCase().slice(0, 2) || '?',
    ext,
  };
}

export function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showTools, setShowTools] = useState(false);
  const completedTools = message.toolCalls?.filter(tc => tc.status !== 'running').length || 0;
  const totalTools = message.toolCalls?.length || 0;

  const { files, cleanContent } = useMemo(
    () => parseFiles(message.content),
    [message.content]
  );

  const hasMarkdown = cleanContent.length > 0;

  return (
    <div className={`py-4 px-8 animate-fade-in-up ${isUser ? '' : 'bg-gray-50 dark:bg-zinc-900/30'}`}>
      <div className="flex gap-3.5">
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-300'
            : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500 dark:text-indigo-300'
        }`}>
          {isUser ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 mb-1 tracking-wide">
            {isUser ? '你' : '{{Pi}}Agent'}
          </div>

          {/* Agent status */}
          {!isUser && streaming && totalTools > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-indigo-400/60 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
              <span className="text-[12px] text-indigo-500 dark:text-indigo-400/80 font-medium">
                {(() => {
                  const running = message.toolCalls?.find(tc => tc.status === 'running');
                  if (running) {
                    const label = {read_file:'Reading',write_file:'Writing',edit_file:'Editing',search_code:'Searching',run_command:'Running'}[running.name] || running.name;
                    const arg = running.args?.path?.toString().split('/').pop() || running.args?.command?.toString().slice(0,30) || '';
                    return `${label} ${arg}`;
                  }
                  return `Executing ${completedTools}/${totalTools} tools`;
                })()}
              </span>
            </div>
          )}

          {/* File attachments */}
          {files.length > 0 && (
            <div className="mb-2.5 space-y-1.5">
              {files.map((f, i) => {
                const meta = getFileMeta(f.name);
                const showPreview = PREVIEWABLE.has(meta.ext);
                const lines = showPreview ? f.content.split('\n') : [];
                return (
                  <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/50">
                    {/* File header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-900/80">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded px-1 py-0.5 min-w-[20px] text-center">
                        {meta.icon}
                      </span>
                      <span className="text-[12px] font-medium text-gray-700 dark:text-zinc-300 font-mono truncate">
                        {f.name}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 ml-auto flex-shrink-0">
                        {f.size}{showPreview ? ` · ${lines.length} lines` : ''}
                      </span>
                    </div>
                    {/* File preview */}
                    {showPreview && (
                      <div className="p-2.5 bg-gray-50 dark:bg-zinc-950/60">
                        <pre className="text-[11px] font-mono leading-relaxed text-gray-600 dark:text-zinc-400 overflow-x-auto max-h-48 overflow-y-auto">
                          {lines.slice(0, 50).map((line, li) => (
                            <div key={li} className="flex">
                              <span className="text-gray-300 dark:text-zinc-700 select-none w-8 flex-shrink-0 text-right pr-3">{li + 1}</span>
                              <span>{line || ' '}</span>
                            </div>
                          ))}
                          {lines.length > 50 && (
                            <div className="text-gray-400 dark:text-zinc-600 mt-1">... {lines.length - 50} more lines</div>
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Message text */}
          {isUser ? (
            cleanContent && !/^Attached \d+ file/.test(cleanContent) ? (
              <div className="text-[15px] leading-relaxed text-gray-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                {cleanContent}
              </div>
            ) : null
          ) : hasMarkdown ? (
            <div className="prose max-w-none text-gray-700 dark:text-zinc-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-500 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {cleanContent}
              </ReactMarkdown>
            </div>
          ) : !files.length && totalTools > 0 && completedTools === 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[12px] text-gray-400 dark:text-zinc-500">Working...</span>
            </div>
          ) : streaming && !hasMarkdown && totalTools === 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[12px] text-gray-400 dark:text-zinc-500">Thinking...</span>
            </div>
          ) : null}

          {/* Tool calls — collapsed summary */}
          {totalTools > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowTools(!showTools)}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${showTools ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                {completedTools}/{totalTools} tools
                {completedTools === totalTools && totalTools > 0 && (
                  <span className="text-emerald-500">✓</span>
                )}
              </button>

              {showTools && (
                <div className="mt-1.5 space-y-1">
                  {message.toolCalls!.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
