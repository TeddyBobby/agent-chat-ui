'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/types';
import { ToolCallCard } from './tool-call-card';
import {
  getToolSummarySnapshot,
  isToolDisclosureOpen,
  reconcileToolSummary,
  type ToolSummaryView,
} from './tool-call-state';
import { reconcileStreamValue, type StreamRenderState } from './stream-throttle';
import { AgentMark } from './agent-mark';
import {
  attachmentExtension,
  parseAttachments,
  PREVIEWABLE_ATTACHMENT_EXTENSIONS,
} from './attachment-message';

// ── Code block copy ──

function extractLanguage(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}

function CodeBlockHeader({ language, codeText }: { language: string | null; codeText: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = codeText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [codeText]);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700/50 rounded-t-[0.625rem]">
      <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
        {language || 'code'}
      </span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "已复制" : "复制代码"}
        className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-emerald-500">Copied</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

function extractCodeChild(children: React.ReactNode): { lang: string | null; text: string } | null {
  // Walk the React element tree to find the <code> child with hljs class
  const walk = (node: React.ReactNode): { lang: string | null; text: string } | null => {
    if (node == null) return null;
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return null;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        const result = walk(child);
        if (result) return result;
      }
      return null;
    }
    // React element
    const el = node as any;
    if (el.type === 'code' && el.props?.className?.includes('hljs')) {
      return {
        lang: extractLanguage(el.props.className),
        text: extractTextContent(el.props.children),
      };
    }
    if (el.props?.children) {
      return walk(el.props.children);
    }
    return null;
  };
  return walk(children);
}

function extractTextContent(children: React.ReactNode): string {
  if (children == null) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number' || typeof children === 'boolean') return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  // React element — drill into children
  if (typeof children === 'object' && 'props' in (children as any)) {
    return extractTextContent((children as any).props.children);
  }
  return '';
}

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
}

const FILE_ICONS: Record<string, string> = {
  ts: 'TS', tsx: 'TS', js: 'JS', jsx: 'JS', json: '{}',
  md: 'MD', css: '#', html: '<>', py: 'PY', yaml: 'Y',
  yml: 'Y', toml: 'T', sh: '$>', bash: '$>', sql: 'DB',
  rs: 'RS', go: 'GO', java: 'JV', vue: 'V', svg: 'SVG',
  pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS',
  ppt: 'PPT', pptx: 'PPT', png: 'IMG', jpg: 'IMG', jpeg: 'IMG',
  gif: 'IMG', webp: 'IMG', zip: 'ZIP', rar: 'RAR', '7z': '7Z',
};

function getFileMeta(name: string) {
  const ext = attachmentExtension(name);
  return {
    icon: FILE_ICONS[ext] || ext.toUpperCase().slice(0, 3) || '?',
    ext,
  };
}

function fileIconClass(ext: string) {
  if (ext === 'pdf') return 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300';
  if (['xls', 'xlsx'].includes(ext)) return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (['doc', 'docx'].includes(ext)) return 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300';
  if (['ppt', 'pptx'].includes(ext)) return 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'].includes(ext)) {
    return 'bg-pink-50 text-pink-500 dark:bg-pink-500/10 dark:text-pink-300';
  }
  return 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400';
}

export function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [toolDisclosure, setToolDisclosure] = useState({
    expanded: false,
    taskRunning: Boolean(streaming),
  });
  const showTools = isToolDisclosureOpen(toolDisclosure, Boolean(streaming));
  const completedTools = message.toolCalls?.filter(tc => tc.status !== 'running').length || 0;
  const totalTools = message.toolCalls?.length || 0;
  const desiredToolSummary = useMemo(
    () => getToolSummarySnapshot(message.toolCalls, Boolean(streaming)),
    [message.toolCalls, streaming],
  );
  const [toolSummary, setToolSummary] = useState<ToolSummaryView>(
    () => ({ ...desiredToolSummary, since: Date.now() }),
  );
  const toolSummaryRef = useRef(toolSummary);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const transition = reconcileToolSummary(toolSummaryRef.current, desiredToolSummary, Date.now());
      if (transition.view !== toolSummaryRef.current) {
        toolSummaryRef.current = transition.view;
        setToolSummary(transition.view);
      }
      if (transition.retryIn) timer = setTimeout(update, transition.retryIn);
    };
    update();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [desiredToolSummary]);

  const { files, cleanContent } = useMemo(
    () => parseAttachments(message.content),
    [message.content]
  );

  // 流式期间节流 markdown 渲染：remark 解析 + rehype 语法高亮对长回复代价很高，
  // 逐 token 重跑会卡顿。这里合并高频 delta，并保证结束后立即落定最终内容。
  const [renderedContent, setRenderedContent] = useState<StreamRenderState>(
    () => ({ value: cleanContent, since: Date.now() }),
  );
  const renderedContentRef = useRef(renderedContent);

  useEffect(() => {
    if (!streaming) {
      if (renderedContentRef.current.value !== cleanContent) {
        renderedContentRef.current = { value: cleanContent, since: Date.now() };
        setRenderedContent(renderedContentRef.current);
      }
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const transition = reconcileStreamValue(renderedContentRef.current, cleanContent, Date.now());
      if (transition.view !== renderedContentRef.current) {
        renderedContentRef.current = transition.view;
        setRenderedContent(transition.view);
      }
      if (transition.retryIn) timer = setTimeout(update, transition.retryIn);
    };
    update();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cleanContent, streaming]);

  const hasMarkdown = cleanContent.length > 0;

  return (
    <div className={`px-8 py-4 animate-fade-in-up ${isUser ? '' : 'bg-[#fafaf8] dark:bg-zinc-900/30'}`}>
      <div className="mx-auto flex max-w-[780px] gap-3.5">
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-300'
            : 'bg-[#eaf8e8] text-[#4ca148] dark:bg-emerald-500/20 dark:text-emerald-300'
        }`}>
          {isUser ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          ) : (
            <AgentMark className="h-5 w-5" compact />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 mb-1 tracking-wide">
            {isUser ? '你' : 'MOAgent'}
          </div>

          {/* File attachments */}
          {files.length > 0 && (
            <div className="mb-2.5 space-y-1.5">
              {files.map((f, i) => {
                const meta = getFileMeta(f.name);
                const showPreview = PREVIEWABLE_ATTACHMENT_EXTENSIONS.has(meta.ext);
                const lines = showPreview ? f.content.split('\n') : [];
                return (
                  <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/50">
                    {/* File header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-900/80">
                      <span className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[8px] font-bold ${fileIconClass(meta.ext)}`}>
                        {meta.icon}
                      </span>
                      <span className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 font-mono truncate">
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
              <div className="text-[14px] leading-relaxed text-gray-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
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
                      className="text-[#4b9f48] underline underline-offset-2 transition-colors hover:text-[#397e36] dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      {children}
                    </a>
                  ),
                  pre: ({ children, ...props }) => {
                    const codeChild = extractCodeChild(children);
                    const lang = codeChild?.lang ?? null;
                    const codeText = codeChild?.text ?? '';
                    return (
                      <div className="my-2">
                        <CodeBlockHeader language={lang} codeText={codeText} />
                        <pre className="!mt-0 !rounded-t-none" {...props}>
                          {children}
                        </pre>
                      </div>
                    );
                  },
                  code: ({ children, className, ...props }) => {
                    // Inline code (no language class from rehype-highlight)
                    if (!className?.includes('hljs')) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    // Block code — rendered inside <pre>, just return as-is
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {renderedContent.value}
              </ReactMarkdown>
            </div>
          ) : !files.length && totalTools > 0 && completedTools === 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[11px] text-gray-400 dark:text-zinc-500">Working...</span>
            </div>
          ) : streaming && !hasMarkdown && totalTools === 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#65d45e]" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[11px] text-gray-400 dark:text-zinc-500">Thinking...</span>
            </div>
          ) : null}

          {/* Tool calls — collapsed summary */}
          {totalTools > 0 && (
            <div className="mt-2">
              <button
                type="button"
                aria-expanded={showTools}
                aria-controls={`tool-calls-${message.id}`}
                onClick={() => setToolDisclosure({ expanded: !showTools, taskRunning: Boolean(streaming) })}
                className={`inline-flex h-7 max-w-full items-center gap-1 rounded-md px-1 text-[11px] transition-colors ${
                  toolSummary.running
                    ? 'text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200'
                    : 'text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-400'
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${showTools ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                {toolSummary.running && (
                  <span className="h-2.5 w-2.5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-500" />
                )}
                <span className="max-w-[360px] truncate text-left">{toolSummary.text}</span>
                {!toolSummary.running && completedTools === totalTools && totalTools > 0 && (
                  <span className="text-emerald-500">✓</span>
                )}
              </button>

              {showTools && (
                <div id={`tool-calls-${message.id}`} className="mt-1.5 space-y-1">
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
