'use client';

import { useState, useEffect } from 'react';

interface DirEntry {
  name: string;
  path: string;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  breadcrumb: { name: string; path: string }[];
  dirs: DirEntry[];
}

interface DirectoryPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export function DirectoryPicker({ value, onChange }: DirectoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = async (dir: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(dir)}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const openBrowser = () => {
    setOpen(true);
    if (!data) browse(value || '~');
  };

  const selectDir = (dir: string) => {
    onChange(dir);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openBrowser}
        className="px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700/80 transition-colors flex-shrink-0"
        title="Browse"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-400">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-[440px] max-h-[65vh] flex flex-col overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-zinc-200">Select Project</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Breadcrumb */}
            {data && (
              <div className="px-4 py-2 border-b border-zinc-800/50 flex items-center gap-1 text-[11px] overflow-x-auto">
                {data.breadcrumb.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1 flex-shrink-0">
                    {i > 0 && <span className="text-zinc-700">/</span>}
                    <button onClick={() => browse(crumb.path)} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-14">
                  <div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                </div>
              ) : data ? (
                <>
                  {data.parent && (
                    <button onClick={() => browse(data.parent!)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 text-[13px] text-zinc-400 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      ..
                    </button>
                  )}
                  {data.dirs.map((d) => (
                    <button
                      key={d.path}
                      onClick={() => browse(d.path)}
                      onDoubleClick={() => selectDir(d.path)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 text-[13px] text-zinc-300 group transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span className="flex-1 text-left truncate">{d.name}</span>
                      <span className="text-[10px] text-indigo-500/0 group-hover:text-indigo-500/60 transition-all">select</span>
                    </button>
                  ))}
                  {data.dirs.length === 0 && !data.parent && (
                    <p className="text-[12px] text-zinc-500 text-center py-10">Empty</p>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 font-mono truncate max-w-[280px]">
                {data?.current || value}
              </span>
              <button
                onClick={() => data && selectDir(data.current)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[12px] font-medium hover:bg-indigo-500/30 border border-indigo-500/20 transition-all"
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
