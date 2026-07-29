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
  const [activeTab, setActiveTab] = useState<PanelTabId>('explorer');
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
    setActiveTab('explorer');
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
    <aside className="relative hidden h-full w-[320px] flex-shrink-0 border-l border-[#dfdfdf] bg-white min-[1200px]:block">
      <section className="absolute left-[24px] top-[28px] h-[218px] w-[271px] overflow-hidden rounded-[11px] border border-[#dfdfdf] bg-[#f5f5f5]">
        <div className="flex border-b border-[#dedede] bg-white/80 p-1.5">
          <span className="flex h-7 items-center px-2 text-[10px] font-medium text-[#555]">工作区</span>
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            disabled={!workdir || loading}
            className="ml-auto h-7 w-7 rounded-md text-[14px] text-[#8a8a8a] hover:bg-white disabled:opacity-30"
            aria-label="刷新工作区"
            title="刷新"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="h-7 w-7 rounded-md text-[14px] text-[#8a8a8a] hover:bg-white"
            aria-label="收起右侧工作区"
            title="收起工作区"
          >
            ›
          </button>
        </div>
        <div className="p-4">
          {workdir ? (
            <>
              <p className="truncate text-[12px] font-medium text-[#444]">{workdir.split('/').pop()}</p>
              <p className="mt-1 truncate text-[9px] text-[#999]">{workdir}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Summary label="文件" value={countFiles(entries)} />
                <Summary label="改动" value={review?.files.length || 0} accent={Boolean(review?.files.length)} />
              </div>
              <p className="mt-3 text-[9px] leading-4 text-[#999]">
                {review?.isGitRepository === false ? '当前目录不是 Git 仓库' : '点击下方文件查看内容，或切换到代码审查。'}
              </p>
            </>
          ) : (
            <div className="flex h-[150px] flex-col items-center justify-center text-center">
              <span className="text-[22px] text-[#c8c8c8]">⌘</span>
              <p className="mt-2 text-[11px] font-medium text-[#777]">尚未选择工作目录</p>
              <p className="mt-1 text-[9px] leading-4 text-[#aaa]">新建对话并选择目录后，可查看文件和代码改动。</p>
            </div>
          )}
        </div>
      </section>

      <section className="absolute bottom-0 left-0 right-0 top-[264px] flex flex-col border-t border-[#ededed]">
        <WorkspaceTabs
          activeTab={activeTab}
          openFiles={openFiles}
          reviewCount={review?.files.length || 0}
          onSelect={setActiveTab}
          onCloseFile={closeFile}
        />
        {error && <p className="m-3 rounded-lg bg-red-50 p-2 text-[10px] text-red-500">{error}</p>}
        {loading && <div className="h-0.5 animate-pulse bg-[#32ce50]" />}
        {activeTab === 'explorer' ? (
          <FileTree entries={entries} truncated={treeTruncated} onOpen={(path) => void openFile(path)} />
        ) : activeTab === 'review' ? (
          <ReviewPreview
            review={review}
            onOpen={(path) => void openFile(path)}
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
}: {
  activeTab: PanelTabId;
  openFiles: WorkspaceFile[];
  reviewCount: number;
  onSelect: (tab: PanelTabId) => void;
  onCloseFile: (path: string) => void;
}) {
  return (
    <div className="flex h-9 flex-shrink-0 items-end overflow-x-auto border-b border-[#dcdcdc] bg-[#eeeeec]">
      <BrowserTab active={activeTab === 'explorer'} label="文件" onClick={() => onSelect('explorer')} />
      <BrowserTab
        active={activeTab === 'review'}
        label="审查"
        badge={reviewCount}
        onClick={() => onSelect('review')}
      />
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
      className={`group flex h-8 max-w-[142px] flex-shrink-0 items-center border-r border-[#d9d9d7] ${
        active ? 'rounded-t-md bg-white text-[#444]' : 'bg-[#eeeeec] text-[#888] hover:bg-[#f7f7f5]'
      }`}
      title={title || label}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center px-2 text-[9px]">
        <span className="truncate">{label}</span>
        {Boolean(badge) && (
          <span className="ml-1 rounded-full bg-[#32ce50] px-1 text-[8px] text-white">{badge}</span>
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

function Summary({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e2e2e2] bg-white px-3 py-2">
      <span className={`text-[18px] font-semibold ${accent ? 'text-[#32ce50]' : 'text-[#444]'}`}>{value}</span>
      <span className="ml-1 text-[9px] text-[#999]">{label}</span>
    </div>
  );
}

function FileTree({ entries, truncated, onOpen }: { entries: WorkspaceEntry[]; truncated: boolean; onOpen: (path: string) => void }) {
  if (entries.length === 0) {
    return <EmptyPanel text="工作区中没有可预览的文件" />;
  }
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {truncated && (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[9px] leading-4 text-amber-700">
          文件较多，仅显示前 500 项和四层目录。
        </p>
      )}
      <TreeNodes entries={entries} onOpen={onOpen} depth={0} />
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
    <div className="workspace-code min-h-0 flex-1 overflow-auto bg-[#0d1117]">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {fencedCode(content, language)}
      </ReactMarkdown>
    </div>
  );
}

function PlainTextFile({ content }: { content: string }) {
  return (
    <pre className="!m-0 min-h-0 flex-1 overflow-auto !rounded-none !border-0 !bg-[#fbfbfb] p-3">
      <code className="!bg-transparent !p-0 !text-[10px] !leading-5 !text-[#555]">{content}</code>
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
  onOpen,
  onRequestReview,
  reviewDisabled,
}: {
  review: WorkspaceReview | null;
  onOpen: (path: string) => void;
  onRequestReview: () => void;
  reviewDisabled: boolean;
}) {
  if (!review?.isGitRepository) return <EmptyPanel text="请选择一个 Git 工作目录" />;
  if (review.files.length === 0) return <EmptyPanel text="当前没有待审查的代码改动" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#ededed] p-2">
        <button
          type="button"
          onClick={onRequestReview}
          disabled={reviewDisabled}
          className="mb-2 h-8 w-full rounded-lg bg-[#1a1a1a] text-[10px] font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reviewDisabled ? '任务进行中' : '让 Agent 审查这些改动'}
        </button>
        <div className="max-h-[120px] overflow-y-auto">
        {review.files.map((file) => (
          <button
            type="button"
            key={`${file.status}-${file.path}`}
            onClick={() => !file.status.includes('D') && onOpen(reviewPath(file.path))}
            disabled={file.status.includes('D')}
            className="flex h-7 w-full items-center rounded-md px-2 text-left text-[10px] hover:bg-[#f5f5f5] disabled:cursor-default disabled:opacity-60"
            title={file.status.includes('D') ? '文件已删除，可在下方 diff 中查看原内容' : `打开 ${file.path}`}
          >
            <span className="mr-2 w-5 font-mono text-[#32a54a]">{file.status}</span>
            <span className="truncate text-[#666]">{file.path}</span>
          </button>
        ))}
        </div>
      </div>
      <pre className="!m-0 min-h-0 flex-1 overflow-auto !rounded-none !border-0 !bg-[#fbfbfb] p-3 text-[9px] leading-4">
        {review.patchTruncated && (
          <code className="mb-2 block rounded bg-amber-50 p-2 !text-[9px] !text-amber-700">
            未跟踪文件的 diff 超过 2MB，已截断显示。
          </code>
        )}
        {review.patch.split('\n').map((line, index) => (
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
        ))}
      </pre>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="flex flex-1 items-center justify-center px-8 text-center text-[10px] leading-5 text-[#aaa]">{text}</div>;
}

function countFiles(entries: WorkspaceEntry[]): number {
  return entries.reduce(
    (count, entry) => count + (entry.type === 'file' ? 1 : countFiles(entry.children || [])),
    0,
  );
}

function reviewPath(path: string) {
  const renameTarget = path.includes(' -> ') ? path.split(' -> ').at(-1) : path;
  return renameTarget?.replace(/^{|}$/g, '') || path;
}
