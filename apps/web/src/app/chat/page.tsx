"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { DirectoryPicker } from "@/components/chat/directory-picker";
import { WelcomeDashboard } from "@/components/chat/welcome-dashboard";
import { TaskPanel } from "@/components/chat/task-panel";
import type { Conversation, Run, RunEvent } from "@/lib/types";
import { MODELS } from "@/lib/types";
import { conversationApi, credentialApi, streamRunEvents } from "@/lib/api";
import { isTerminalRunEvent } from "@pi-agent/contracts";

const SETTINGS_KEY = "agent-chat-ui-settings";
const LEGACY_CONVERSATIONS_KEY = "agent-chat-ui-conversations";
const MIGRATION_KEY = "agent-chat-ui-server-migrated";

function loadSettings() {
  if (typeof window === "undefined") return { model: MODELS[0].id, baseUrl: "" };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "") as { model?: string; baseUrl?: string };
    return { model: stored.model || MODELS[0].id, baseUrl: stored.baseUrl || "" };
  } catch {
    return { model: MODELS[0].id, baseUrl: "" };
  }
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const subscriptions = useRef(new Map<string, AbortController>());
  const credentialSave = useRef<Promise<void> | null>(null);

  const conversationUrl = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    return `/chat?${params.toString()}`;
  };

  const refresh = useCallback(async () => {
    const next = await conversationApi.list();
    setConversations(next);
    return next;
  }, []);

  const migrateLegacyData = useCallback(async () => {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    try {
      const raw = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
      const legacy = raw ? JSON.parse(raw) : [];
      if (Array.isArray(legacy) && legacy.length > 0) {
        await conversationApi.importLegacy(legacy);
      }
      localStorage.removeItem(LEGACY_CONVERSATIONS_KEY);
      localStorage.setItem(MIGRATION_KEY, "1");
    } catch (error) {
      console.warn("[migration] legacy conversations were not imported", error);
    }
  }, []);

  const applyEvent = useCallback((conversationId: string, run: Run, event: RunEvent) => {
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const messages = conversation.messages.map((message) => {
        if (message.id !== run.assistantMessageId) return message;
        if (event.type === "assistant.delta") return { ...message, content: message.content + event.content };
        if (event.type === "tool.started") {
          return { ...message, toolCalls: [...(message.toolCalls || []), event.tool] };
        }
        if (event.type === "tool.completed") {
          return {
            ...message,
            toolCalls: (message.toolCalls || []).map((tool) => tool.id === event.toolId
              ? { ...tool, result: event.result, error: event.error, status: event.error ? "error" as const : "completed" as const }
              : tool),
          };
        }
        if (event.type === "run.failed") return { ...message, content: `${message.content}\n\n❌ ${event.message}` };
        return message;
      });
      const terminal = isTerminalRunEvent(event);
      return {
        ...conversation,
        messages,
        activeRun: terminal ? undefined : { ...(conversation.activeRun || run), lastSeq: event.seq, status: event.type === "run.started" ? "running" : (conversation.activeRun || run).status },
      };
    }));
  }, []);

  const attachRun = useCallback((conversationId: string, run: Run) => {
    if (subscriptions.current.has(run.id)) return;
    const controller = new AbortController();
    subscriptions.current.set(run.id, controller);
    void streamRunEvents({
      runId: run.id,
      after: run.lastSeq,
      signal: controller.signal,
      onEvent: (event) => applyEvent(conversationId, run, event),
    }).finally(async () => {
      subscriptions.current.delete(run.id);
      if (!controller.signal.aborted) await refresh().catch(() => undefined);
    });
  }, [applyEvent, refresh]);

  useEffect(() => {
    const settings = loadSettings();
    setModel(settings.model);
    setBaseUrl(settings.baseUrl || "");
    void Promise.all([
      migrateLegacyData().then(refresh),
      credentialApi.status().catch(() => ({ configured: false })),
    ]).then(([loaded, credential]) => {
      setApiKeyConfigured(credential.configured);
      const urlId = searchParams.get("id");
      const selected = loaded.find((conversation) => conversation.id === urlId) ||
        loaded.find((conversation) => !conversation.archived);
      if (selected) {
        setActiveId(selected.id);
        setModel(selected.model);
        router.replace(conversationUrl(selected.id), { scroll: false });
      }
      for (const conversation of loaded) {
        if (conversation.activeRun) attachRun(conversation.id, conversation.activeRun);
      }
      setHydrated(true);
    });
    return () => {
      for (const controller of subscriptions.current.values()) controller.abort();
      subscriptions.current.clear();
    };
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model, baseUrl }));
  }, [model, baseUrl, hydrated]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const runningIds = useMemo(
    () => new Set(conversations.filter((conversation) => conversation.activeRun).map((conversation) => conversation.id)),
    [conversations],
  );

  const createConversation = async (workdir: string) => {
    const conversation = await conversationApi.create({ model, workdir });
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    router.replace(conversationUrl(conversation.id), { scroll: false });
  };

  const handleSend = async (content: string) => {
    await commitApiKey();
    let conversation = activeConversation;
    if (!conversation) {
      conversation = await conversationApi.create({ model, workdir: "" });
      setActiveId(conversation.id);
      router.replace(conversationUrl(conversation.id), { scroll: false });
    }
    const modelInfo = MODELS.find((entry) => entry.id === model);
    const run = await conversationApi.startRun(conversation.id, {
      content,
      model,
      baseUrl: baseUrl || modelInfo?.baseUrl,
      contextLimit: modelInfo?.contextLimit,
      idempotencyKey: crypto.randomUUID(),
    });
    const snapshot = await conversationApi.get(conversation.id);
    setConversations((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)]);
    attachRun(conversation.id, snapshot.activeRun || run);
  };

  const commitApiKey = async () => {
    if (credentialSave.current) return credentialSave.current;
    const value = apiKey.trim();
    if (!value) return;
    setCredentialSaving(true);
    const save = credentialApi.save(value)
      .then(() => {
        setApiKey("");
        setApiKeyConfigured(true);
        setCredentialError("");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "保存 API Key 失败";
        setCredentialError(message);
        throw error;
      })
      .finally(() => {
        setCredentialSaving(false);
        credentialSave.current = null;
      });
    credentialSave.current = save;
    return save;
  };

  const logout = async () => {
    await credentialSave.current?.catch(() => undefined);
    await credentialApi.logout();
    setApiKey("");
    setApiKeyConfigured(false);
    setCredentialError("");
  };

  const updateConversation = async (id: string, updates: { workdir?: string; archived?: boolean }) => {
    const updated = await conversationApi.update(id, updates);
    setConversations((current) => current.map((conversation) => conversation.id === id ? updated : conversation));
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    router.replace(conversationUrl(id), { scroll: false });
    const selected = conversations.find((conversation) => conversation.id === id);
    if (selected) setModel(selected.model);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#292929] dark:bg-zinc-950 dark:text-zinc-200">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        runningConvIds={runningIds}
        onSelect={selectConversation}
        onArchive={(id) => void updateConversation(id, { archived: true }).then(() => activeId === id && setActiveId(null))}
        onRestore={(id) => void updateConversation(id, { archived: false })}
        onDelete={(id) => void conversationApi.delete(id).then(() => {
          setConversations((current) => current.filter((conversation) => conversation.id !== id));
          if (activeId === id) setActiveId(null);
        })}
        onNewChat={() => setShowPicker(true)}
        onLogout={logout}
        apiKeyConfigured={apiKeyConfigured}
      />
      <main className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950 min-[1440px]:w-[836px] min-[1440px]:flex-none">
        {(activeConversation?.messages.length || 0) > 0 ? (
          <MessageList
            messages={activeConversation?.messages || []}
            streaming={Boolean(activeConversation?.activeRun)}
          />
        ) : (
          <WelcomeDashboard
            onNewChat={() => setShowPicker(true)}
            onFocusInput={() => document.getElementById("agent-chat-composer")?.focus()}
          />
        )}
        <ChatInput
          onSend={(content) => void handleSend(content)}
          onModelChange={setModel}
          selectedModel={model}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          apiKeyConfigured={apiKeyConfigured}
          credentialSaving={credentialSaving}
          credentialError={credentialError}
          onApiKeyCommit={commitApiKey}
          onLogout={logout}
          baseUrl={baseUrl}
          onBaseUrlChange={setBaseUrl}
          workdir={activeConversation?.workdir || ""}
          onWorkdirChange={(workdir) => activeId && void updateConversation(activeId, { workdir })}
          disabled={Boolean(activeConversation?.activeRun)}
          contextTokens={activeConversation?.contextTokens ?? 0}
          contextLimit={MODELS.find((entry) => entry.id === activeConversation?.model)?.contextLimit ?? 128_000}
          figmaPlacement={(activeConversation?.messages.length || 0) === 0}
        />
      </main>
      <TaskPanel />
      <DirectoryPicker
        value=""
        open={showPicker}
        onChange={(workdir) => {
          setShowPicker(false);
          void createConversation(workdir);
        }}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
}
