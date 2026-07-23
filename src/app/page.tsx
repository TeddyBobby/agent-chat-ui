'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/chat/sidebar';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { Conversation, Message, ToolCall, MODELS, AgentEvent } from '@/lib/types';
import {
  getConversations,
  createConversation,
  deleteConversation,
  addMessage,
  updateMessage,
  appendToMessage,
} from '@/lib/store';

const SETTINGS_KEY = 'agent-chat-ui-settings';

function loadSettings(): { model: string; apiKey: string; workdir: string } {
  if (typeof window === 'undefined') return { model: MODELS[0].id, apiKey: '', workdir: '' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { model: MODELS[0].id, apiKey: '', workdir: '' };
  } catch {
    return { model: MODELS[0].id, apiKey: '', workdir: '' };
  }
}

function saveSettings(settings: { model: string; apiKey: string; workdir: string }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [workdir, setWorkdir] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0); // 强制重渲染计数器

  // 客户端挂载后从 localStorage 恢复状态
  useEffect(() => {
    const convs = getConversations();
    setConversations(convs);
    // 默认选中最近的对话
    if (convs.length > 0 && !activeId) {
      setActiveId(convs[0].id);
      setModel(convs[0].model);
      setWorkdir(convs[0].workdir || '');
    }
    const s = loadSettings();
    if (convs.length === 0) {
      setModel(s.model);
      setWorkdir(s.workdir);
    }
    setApiKey(s.apiKey);
    setHydrated(true);
  }, []);

  // 设置变更时自动持久化（跳过首次 hydration 前的保存）
  useEffect(() => {
    if (hydrated) saveSettings({ model, apiKey, workdir });
  }, [model, apiKey, workdir, hydrated]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  const refreshConversations = useCallback(() => {
    setConversations([...getConversations()]);
  }, []);

  const handleNewChat = () => {
    const conv = createConversation('新对话', model, workdir);
    refreshConversations();
    setActiveId(conv.id);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    const conv = getConversations().find((c) => c.id === id);
    if (conv) {
      setModel(conv.model);
      setWorkdir(conv.workdir || '');
    }
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    if (activeId === id) setActiveId(null);
    refreshConversations();
  };

  const handleSend = async (content: string) => {
    let convId = activeId;
    if (!convId) {
      const conv = createConversation('新对话', model, workdir);
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

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
    };
    addMessage(convId, assistantMsg);

    refreshConversations();
    setStreaming(true);

    try {
      const conv = getConversations().find((c) => c.id === convId);
      if (!conv) return;

      const messages = conv.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

      // Determine base URL from model config
      const modelInfo = MODELS.find((m) => m.id === model);
      const baseUrl = modelInfo?.baseUrl;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          apiKey: apiKey || '',
          baseUrl: baseUrl || undefined,
          workdir: workdir || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        updateMessage(convId, assistantMsg.id, {
          content: `❌ Error: ${err.error || 'Unknown error'}`,
        });
        refreshConversations();
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        updateMessage(convId, assistantMsg.id, { content: 'No response.' });
        refreshConversations();
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event: AgentEvent = JSON.parse(data);
            handleAgentEvent(convId, assistantMsg.id, event);
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (error) {
      updateMessage(convId, assistantMsg.id, {
        content: `❌ Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
      });
      refreshConversations();
    } finally {
      setStreaming(false);
    }
  };

  /** 处理单个 SSE 事件 */
  function handleAgentEvent(convId: string, msgId: string, event: AgentEvent) {
    setTick(t => t + 1); // 强制重渲染
    switch (event.type) {
      case 'start':
        // workdir 确认
        break;

      case 'tool_call': {
        // 创建新的 tool call（状态 running）
        const tc: ToolCall = {
          id: event.id || crypto.randomUUID(),
          name: event.name,
          arguments: event.arguments,
          status: 'running',
        };
        const conv = getConversations().find((c) => c.id === convId);
        const msg = conv?.messages.find((m) => m.id === msgId);
        if (msg) {
          updateMessage(convId, msgId, {
            toolCalls: [...(msg.toolCalls || []), tc],
          });
        }
        refreshConversations();
        break;
      }

      case 'tool_result': {
        // 精确匹配 tool_call ID
        const conv2 = getConversations().find((c) => c.id === convId);
        const msg2 = conv2?.messages.find((m) => m.id === msgId);
        if (!msg2?.toolCalls) break;

        const tcs = [...msg2.toolCalls];
        const idx = tcs.findIndex((tc) => tc.id === event.id);
        if (idx === -1) {
          // 降级：匹配最后一个 running 的
          for (let i = tcs.length - 1; i >= 0; i--) {
            if (tcs[i].status === 'running') {
              tcs[i] = {
                ...tcs[i],
                status: event.error ? 'error' : 'completed',
                result: event.result,
                error: event.error,
              };
              updateMessage(convId, msgId, { toolCalls: tcs });
              refreshConversations();
              break;
            }
          }
        } else {
          tcs[idx] = {
            ...tcs[idx],
            status: event.error ? 'error' : 'completed',
            result: event.result,
            error: event.error,
          };
          updateMessage(convId, msgId, { toolCalls: tcs });
          refreshConversations();
        }
        break;
      }

      case 'text':
        // 追加文本内容
        appendToMessage(convId, msgId, event.content);
        refreshConversations();
        break;

      case 'error':
        appendToMessage(convId, msgId, `\n\n❌ ${event.message}`);
        refreshConversations();
        break;

      case 'done':
        // 流结束
        break;
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onNewChat={handleNewChat}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workdir banner */}
        {activeConv?.workdir && (
          <div className="px-8 py-1.5 bg-indigo-500/5 border-b border-indigo-500/10">
            <span className="text-[11px] text-indigo-400/80 font-mono tracking-wide">
              {activeConv.workdir}
            </span>
          </div>
        )}
        <MessageList messages={activeConv?.messages || []} streaming={streaming} />
        <ChatInput
          onSend={handleSend}
          onModelChange={setModel}
          selectedModel={model}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          workdir={workdir}
          onWorkdirChange={setWorkdir}
          disabled={streaming}
        />
      </div>
    </div>
  );
}
