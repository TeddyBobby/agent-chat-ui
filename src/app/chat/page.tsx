'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/chat/sidebar';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { DirectoryPicker } from '@/components/chat/directory-picker';
import { Conversation, Message, MODELS } from '@/lib/types';
import {
  getConversations,
  createConversation,
  deleteConversation,
  archiveConversation,
  restoreConversation,
  updateConversationWorkdir,
  addMessage,
  updateMessage,
} from '@/lib/store';
import { createAgentStream } from '@/lib/stream/engine';

const SETTINGS_KEY = 'agent-chat-ui-settings';

function loadSettings(): { model: string; apiKey: string; baseUrl: string } {
  if (typeof window === 'undefined') return { model: MODELS[0].id, apiKey: '', baseUrl: '' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { model: MODELS[0].id, apiKey: '', baseUrl: '' };
  } catch {
    return { model: MODELS[0].id, apiKey: '', baseUrl: '' };
  }
}

function saveSettings(settings: { model: string; apiKey: string; baseUrl: string }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runningConvId, setRunningConvId] = useState<string | null>(null);
  const isActiveStreaming = runningConvId === activeId;
  const [model, setModel] = useState(MODELS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const streamRef = useRef<Map<string, ReturnType<typeof createAgentStream>>>(new Map());

  useEffect(() => {
    const convs = getConversations();
    setConversations(convs);
    // URL 里指定的会话优先
    const urlId = searchParams.get('id');
    if (urlId && convs.find(c => c.id === urlId)) {
      setActiveId(urlId);
      setModel(convs.find(c => c.id === urlId)!.model);
    } else {
      // 否则自动选中最新的活跃会话
      const active = convs.filter(c => !c.archived);
      if (active.length > 0) {
        setActiveId(active[0].id);
        setModel(active[0].model);
        router.replace(`/chat?id=${active[0].id}`, { scroll: false });
      }
    }
    const s = loadSettings();
    setModel(s.model);
    setApiKey(s.apiKey);
    setBaseUrl(s.baseUrl || '');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings({ model, apiKey, baseUrl });
  }, [model, apiKey, baseUrl, hydrated]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  const refreshConversations = useCallback(() => {
    setConversations([...getConversations()]);
  }, []);

  const handleNewChat = (workdir?: string) => {
    if (workdir) {
      const conv = createConversation('新对话', model, workdir);
      refreshConversations();
      setActiveId(conv.id);
      router.replace(`/chat?id=${conv.id}`, { scroll: false });
      return;
    }
    setShowPicker(true);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    router.replace(`/chat?id=${id}`, { scroll: false });
    const conv = getConversations().find((c) => c.id === id);
    if (conv) setModel(conv.model);
  };

  const handleWorkdirChange = (dir: string) => {
    if (!activeId) return;
    updateConversationWorkdir(activeId, dir);
    refreshConversations();
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    if (activeId === id) setActiveId(null);
    refreshConversations();
  };

  const handleArchive = (id: string) => {
    archiveConversation(id);
    if (activeId === id) setActiveId(null);
    refreshConversations();
  };

  const handleRestore = (id: string) => {
    restoreConversation(id);
    refreshConversations();
  };

  const handleSend = (content: string) => {
    let convId = activeId;
    if (!convId) {
      const conv = createConversation('新对话', model, activeConv?.workdir || '');
      convId = conv.id;
      setActiveId(convId);
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(convId, userMsg);

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
    };
    addMessage(convId, assistantMsg);

    refreshConversations();
    setRunningConvId(convId);

    const conv = getConversations().find((c) => c.id === convId);
    if (!conv) return;

    const messages = conv.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const modelInfo = MODELS.find((m) => m.id === model);
    const effectiveBaseUrl = baseUrl || modelInfo?.baseUrl;

    // 如果当前会话已有运行中的 stream，先停掉旧的
    const existing = streamRef.current.get(convId);
    if (existing) existing.destroy();

    const stream = createAgentStream({
      onStatusChange: () => {},
      onTick: () => { setTick((t) => t + 1); refreshConversations(); },
    });
    streamRef.current.set(convId, stream);

    stream.send({
      convId,
      assistantMsgId,
      messages,
      model,
      apiKey,
      baseUrl: effectiveBaseUrl,
      workdir: activeConv?.workdir,
      contextLimit: modelInfo?.contextLimit,
    }).finally(() => {
      setRunningConvId(null);
    });
  };

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-200">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        runningConvId={runningConvId}
        onSelect={handleSelect}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onNewChat={handleNewChat}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workdir banner */}
        {activeConv?.workdir && (
          <div className="px-8 py-1.5 bg-indigo-500/5 border-b border-indigo-500/10">
            <span className="text-[11px] text-indigo-500 font-mono tracking-wide">
              {activeConv.workdir}
            </span>
          </div>
        )}

        {activeConv ? (
          <MessageList messages={activeConv.messages} streaming={isActiveStreaming} />
        ) : (
          <MessageList messages={[]} streaming={false} />
        )}
        <ChatInput
          onSend={handleSend}
          onModelChange={setModel}
          selectedModel={model}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          baseUrl={baseUrl}
          onBaseUrlChange={setBaseUrl}
          workdir={activeConv?.workdir || ''}
          onWorkdirChange={handleWorkdirChange}
          disabled={!!runningConvId && runningConvId === activeId}
          contextTokens={activeConv?.contextTokens ?? 0}
          contextLimit={MODELS.find(m => m.id === activeConv?.model)?.contextLimit ?? 128000}
        />
      </div>

      {/* 新建对话目录选择器 */}
      <DirectoryPicker
        value=""
        open={showPicker}
        onChange={(dir) => { setShowPicker(false); handleNewChat(dir); }}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
}
