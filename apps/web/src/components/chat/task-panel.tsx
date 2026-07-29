'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import {
  workspaceApi,
  type WorkspaceEntry,
  type WorkspaceFile,
  type WorkspaceReview,
} from '@/lib/api';
import { patchForReviewFile, reviewPath } from './review-patch';

interface TaskPanelProps {
  workdir: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onRequestReview: () => void;
  reviewDisabled?: boolean;
}

type PanelTabId = 'explorer' | 'review' | `file:${string}`;

export function TaskPanel({
  workdir,
  collapsed,
  onCollapsedChange,
  onRequestReview,
  reviewDisabled = false,
}: TaskPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTabId>('review');
  const [openFiles, setOpenFiles] = useState<WorkspaceFile[]>([]);
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [review, setReview] = useState<WorkspaceReview | null>(null);
  const [treeTruncated, setTreeTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadVersion = useRef(0);

  const loadWorkspace = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!workdir) {
      setEntries([]);
      setTreeTruncated(false);
      setReview(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [tree, nextReview] = await Promise.all([
        workspaceApi.tree(workdir),
        workspaceApi.review(workdir),
      ]);
      if (version !== loadVersion.current) return;
      setEntries(tree.entries);
      setTreeTruncated(tree.truncated);
      setReview(nextReview);
    } catch (reason) {
      if (version !== loadVersion.current) return;
      setError(reason instanceof Error ? reason.message : '无法读取工作区');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [workdir]);

  useEffect(() => {
    // A workspace identity change resets its browser-style tabs before loading the new tree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenFiles([]);
    setActiveTab('review');
    void loadWorkspace();
  }, [loadWorkspace]);

  const openFile = async (path: string) => {
    if (!workdir) return;
    const tabId = `file:${path}` as const;
    if (openFiles.some((file) => file.path === path)) {
      setActiveTab(tabId);
      return;
    }
    const version = loadVersion.current;
    setLoading(true);
    setError('');
    try {
      const file = await workspaceApi.file(workdir, path);
      if (version !== loadVersion.current) return;
      setOpenFiles((current) => current.some((entry) => entry.path === path) ? current : [...current, file]);
      setActiveTab(tabId);
    } catch (reason) {
      if (version !== loadVersion.current) return;
      setError(reason instanceof Error ? reason.message : '无法读取文件');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  const closeFile = (path: string) => {
    const tabId = `file:${path}` as const;
    if (activeTab === tabId) {
      const index = openFiles.findIndex((file) => file.path === path);
      const adjacent = openFiles[index - 1] || openFiles[index + 1];
      setActiveTab(adjacent ? `file:${adjacent.path}` : 'explorer');
    }
    setOpenFiles((current) => current.filter((file) => file.path !== path));
  };

  const activeFile = activeTab.startsWith('file:')
    ? openFiles.find((file) => `file:${file.path}` === activeTab)
    : undefined;

  if (collapsed) {
    return null;
  }

  return (
    <aside className="hidden h-full w-[clamp(420px,44vw,680px)] flex-shrink-0 border-l border-[#dfdfdf] bg-white min-[1200px]:flex min-[1200px]:flex-col dark:border-zinc-800 dark:bg-[#151515]">
      <section className="flex min-h-0 flex-1 flex-col">
        <WorkspaceTabs
          activeTab={activeTab}
          openFiles={openFiles}
          reviewCount={review?.files.length || 0}
          onSelect={setActiveTab}
          onCloseFile={closeFile}
          onRefresh={() => void loadWorkspace()}
          refreshDisabled={!workdir || loading}
          onClosePanel={() => onCollapsedChange(true)}
        />
        {error && <p className="m-3 rounded-lg bg-red-50 p-2 text-[10px] text-red-500">{error}</p>}
        {loading && <div className="h-0.5 animate-pulse bg-[#32ce50]" />}
        {activeTab === 'explorer' ? (
          <FileTree entries={entries} truncated={treeTruncated} onOpen={(path) => void openFile(path)} />
        ) : activeTab === 'review' ? (
          <ReviewPreview
            review={review}
            onRequestReview={onRequestReview}
            reviewDisabled={reviewDisabled}
          />
        ) : activeFile ? (
          <FilePreview key={activeFile.path} file={activeFile} />
        ) : (
          <EmptyPanel text="文件标签已关闭" />
        )}
      </section>
    </aside>
  );
}

function WorkspaceTabs({
  activeTab,
  openFiles,
  reviewCount,
  onSelect,
  onCloseFile,
  onRefresh,
  refreshDisabled,
  onClosePanel,
}: {
  activeTab: PanelTabId;
  openFiles: WorkspaceFile[];
  reviewCount: number;
  onSelect: (tab: PanelTabId) => void;
  onCloseFile: (path: string) => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  onClosePanel: () => void;
}) {
  return (
    <div className="flex h-12 flex-shrink-0 items-center overflow-x-auto border-b border-[#dcdcdc] bg-[#f5f5f4] px-2 dark:border-zinc-800 dark:bg-[#191919]">
      <BrowserTab
        active={activeTab === 'review'}
        label="审阅"
        badge={reviewCount}
        onClick={() => onSelect('review')}
      />
      <BrowserTab active={activeTab === 'explorer'} label="打开文件" onClick={() => onSelect('explorer')} />
      {openFiles.map((file) => (
        <BrowserTab
          key={file.path}
          active={activeTab === `file:${file.path}`}
          label={file.path.split('/').pop() || file.path}
          title={file.path}
          closable
          onClick={() => onSelect(`file:${file.path}`)}
          onClose={() => onCloseFile(file.path)}
        />
      ))}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshDisabled}
        className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[14px] text-[#888] hover:bg-white disabled:opacity-30 dark:hover:bg-zinc-800"
        aria-label="刷新右侧内容"
        title="刷新"
      >
        ↻
      </button>
      <button
        type="button"
        onClick={onClosePanel}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[18px] text-[#888] hover:bg-white dark:hover:bg-zinc-800"
        aria-label="收起右侧工作区"
        title="收起"
      >
        ×
      </button>
    </div>
  );
}

function BrowserTab({
  active,
  label,
  title,
  badge,
  closable = false,
  onClick,
  onClose,
}: {
  active: boolean;
  label: string;
  title?: string;
  badge?: number;
  closable?: boolean;
  onClick: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className={`group mx-0.5 flex h-9 max-w-[160px] flex-shrink-0 items-center rounded-lg ${
        active
          ? 'bg-white text-[#333] shadow-sm dark:bg-[#292929] dark:text-zinc-100'
          : 'text-[#777] hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800'
      }`}
      title={title || label}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center px-3 text-[10px]">
        <span className="truncate">{label}</span>
        {Boolean(badge) && (
          <span className="ml-1.5 rounded-full bg-[#32ce50] px-1.5 text-[8px] text-white">{badge}</span>
        )}
      </button>
      {closable && (
        <button
          type="button"
          onClick={onClose}
          className="mr-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[11px] text-[#aaa] hover:bg-[#dededc] hover:text-[#555]"
          aria-label={`关闭 ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

function FileTree({ entries, truncated, onOpen }: { entries: WorkspaceEntry[]; truncated: boolean; onOpen: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const visibleEntries = query.trim() ? filterEntries(entries, query.trim().toLowerCase()) : entries;

  if (entries.length === 0) {
    return <EmptyPanel text="工作区中没有可预览的文件" />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#ededed] p-3 dark:border-zinc-800">
        <label className="flex h-9 items-center rounded-lg border border-[#dedede] bg-white px-3 text-[#999] dark:border-zinc-700 dark:bg-[#202020]">
          <span className="mr-2 text-[14px]">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[10px] text-[#555] outline-none placeholder:text-[#aaa] dark:text-zinc-200"
            placeholder="筛选文件…"
            aria-label="筛选文件"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {truncated && (
          <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[9px] leading-4 text-amber-700">
            文件较多，仅显示前 500 项和四层目录。
          </p>
        )}
        {visibleEntries.length > 0
          ? <TreeNodes entries={visibleEntries} onOpen={onOpen} depth={0} />
          : <EmptyPanel text="没有匹配的文件" />}
      </div>
    </div>
  );
}

function TreeNodes({ entries, onOpen, depth }: { entries: WorkspaceEntry[]; onOpen: (path: string) => void; depth: number }) {
  const [closed, setClosed] = useState<Set<string>>(
    () => new Set(entries.filter((entry) => entry.type === 'directory').map((entry) => entry.path)),
  );
  return (
    <>
      {entries.map((entry) => (
        <div key={entry.path}>
          <button
            type="button"
            onClick={() => {
              if (entry.type === 'file') return onOpen(entry.path);
              setClosed((current) => {
                const next = new Set(current);
                if (next.has(entry.path)) next.delete(entry.path);
                else next.add(entry.path);
                return next;
              });
            }}
            className="flex h-7 w-full items-center rounded-md pr-2 text-left text-[10px] text-[#666] hover:bg-[#f5f5f5]"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <span className="mr-1.5 w-3 text-center text-[#aaa]">
              {entry.type === 'directory' ? (closed.has(entry.path) ? '›' : '⌄') : '·'}
            </span>
            <span className="truncate">{entry.name}</span>
          </button>
          {entry.type === 'directory' && !closed.has(entry.path) && entry.children?.length ? (
            <TreeNodes entries={entry.children} onOpen={onOpen} depth={depth + 1} />
          ) : null}
        </div>
      ))}
    </>
  );
}

function FilePreview({ file }: { file: WorkspaceFile }) {
  const markdown = file.language === 'markdown';
  const [view, setView] = useState<'preview' | 'source'>(markdown ? 'preview' : 'source');
  const [copied, setCopied] = useState(false);

  const copyFile = async () => {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-[#ededed] px-3">
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#555]">{file.path}</span>
        {markdown && (
          <div className="mr-1 flex rounded-md bg-[#f3f3f2] p-0.5">
            <PreviewToggle active={view === 'preview'} onClick={() => setView('preview')}>预览</PreviewToggle>
            <PreviewToggle active={view === 'source'} onClick={() => setView('source')}>源码</PreviewToggle>
          </div>
        )}
        <button
          type="button"
          onClick={() => void copyFile()}
          className="rounded px-1.5 py-1 text-[8px] text-[#999] hover:bg-[#f3f3f2] hover:text-[#555]"
          aria-label={`复制 ${file.path}`}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {markdown && view === 'preview' ? (
          <MarkdownFile content={file.content} />
        ) : file.language === 'text' ? (
          <PlainTextFile content={file.content} />
        ) : (
          <CodeFile content={file.content} language={file.language} />
        )}
      </div>
    </div>
  );
}

function PreviewToggle({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[8px] ${active ? 'bg-white text-[#444] shadow-sm' : 'text-[#999]'}`}
    >
      {children}
    </button>
  );
}

function MarkdownFile({ content }: { content: string }) {
  return (
    <div className="workspace-markdown prose min-h-0 flex-1 overflow-auto px-4 py-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeFile({ content, language }: { content: string; language: string }) {
  return (
    <div className="workspace-code min-h-0 flex-1 overflow-auto bg-[#f5f5f3] dark:bg-[#222]">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {fencedCode(content, language)}
      </ReactMarkdown>
    </div>
  );
}

function PlainTextFile({ content }: { content: string }) {
  return (
    <pre className="!m-0 min-h-0 flex-1 overflow-auto !rounded-none !border-0 !bg-[#f7f7f5] p-3 dark:!bg-[#222]">
      <code className="!bg-transparent !p-0 !text-[10px] !leading-5 !text-[#555] dark:!text-zinc-300">{content}</code>
    </pre>
  );
}

function fencedCode(content: string, language: string) {
  const runs = content.match(/`+/g) || [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}${language}\n${content}\n${fence}`;
}

function ReviewPreview({
  review,
  onRequestReview,
  reviewDisabled,
}: {
  review: WorkspaceReview | null;
  onRequestReview: () => void;
  reviewDisabled: boolean;
}) {
  const [requestedPath, setRequestedPath] = useState<string | null>(null);

  if (!review?.isGitRepository) return <EmptyPanel text="请选择一个 Git 工作目录" />;
  if (review.files.length === 0) return <EmptyPanel text="当前没有待审查的代码改动" />;

  const selectedFile = review.files.find((file) => file.path === requestedPath) || review.files[0];
  const selectedPath = reviewPath(selectedFile.path);
  const selectedPatch = patchForReviewFile(review.patch, selectedPath);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-shrink-0 items-center border-b border-[#ededed] px-4 dark:border-zinc-800">
        <span className="text-[11px] font-medium text-[#555] dark:text-zinc-300">代码改动</span>
        <span className="ml-2 text-[10px] text-[#32a54a]">{review.files.length} 个文件</span>
        <span className="ml-3 min-w-0 truncate text-[9px] text-[#999]" title={selectedPath}>{selectedPath}</span>
        <button
          type="button"
          onClick={onRequestReview}
          disabled={reviewDisabled}
          className="ml-auto h-8 rounded-lg bg-[#1a1a1a] px-3 text-[10px] font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {reviewDisabled ? '任务进行中' : '让 Agent 审查'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <pre className="!m-0 min-h-0 min-w-0 flex-1 overflow-auto !rounded-none !border-0 !bg-[#f7f7f5] p-3 text-[9px] leading-4 dark:!bg-[#222]">
          {review.patchTruncated && (
            <code className="mb-2 block rounded bg-amber-50 p-2 !text-[9px] !text-amber-700">
              未跟踪文件的 diff 超过 2MB，已截断显示。
            </code>
          )}
          {selectedPatch ? (
            selectedPatch.split('\n').map((line, index) => (
              <code
                key={`${index}-${line}`}
                className={`block whitespace-pre !bg-transparent !p-0 !text-[9px] ${
                  line.startsWith('+') && !line.startsWith('+++')
                    ? '!text-[#218739]'
                    : line.startsWith('-') && !line.startsWith('---')
                      ? '!text-[#c84b4b]'
                      : '!text-[#777]'
                }`}
              >
                {line || ' '}
              </code>
            ))
          ) : (
            <code className="block !bg-transparent !p-0 !text-[9px] !text-[#999]">
              当前文件的 Diff 未包含在审阅结果中，请刷新后重试。
            </code>
          )}
        </pre>
        <div className="w-[190px] flex-shrink-0 overflow-y-auto border-l border-[#ededed] p-2 dark:border-zinc-800">
          <p className="px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-[#999]">变更文件</p>
          {review.files.map((file) => (
            <button
              type="button"
              key={`${file.status}-${file.path}`}
              onClick={() => setRequestedPath(file.path)}
              aria-pressed={selectedFile.path === file.path}
              className={`flex min-h-8 w-full items-center rounded-md px-2 text-left text-[10px] ${
                selectedFile.path === file.path
                  ? 'bg-[#eeeeec] dark:bg-zinc-800'
                  : 'hover:bg-[#f5f5f5] dark:hover:bg-zinc-800'
              }`}
              title={`审阅 ${file.path}`}
            >
              <span className="mr-2 w-5 flex-shrink-0 font-mono text-[#32a54a]">{file.status}</span>
              <span className="truncate text-[#666] dark:text-zinc-400">{file.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="flex flex-1 items-center justify-center px-8 text-center text-[10px] leading-5 text-[#aaa]">{text}</div>;
}

function filterEntries(entries: WorkspaceEntry[], query: string): WorkspaceEntry[] {
  return entries.flatMap((entry) => {
    if (entry.type === 'file') return entry.path.toLowerCase().includes(query) ? [entry] : [];
    const children = filterEntries(entry.children || [], query);
    return entry.path.toLowerCase().includes(query) || children.length > 0
      ? [{ ...entry, children }]
      : [];
  });
}
