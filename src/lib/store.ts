import { Conversation, Message, ToolCall } from './types';

const STORAGE_KEY = 'agent-chat-ui-conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const convs: Conversation[] = JSON.parse(raw);
    // 兼容旧数据没有 contextTokens / archived 字段
    for (const c of convs) {
      if (c.contextTokens === undefined) c.contextTokens = estimateTokens(c.messages);
      if (c.archived === undefined) c.archived = false;
      // 兼容旧字段名 arguments → args
      for (const m of c.messages) {
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            if ((tc as any).arguments && !tc.args) {
              tc.args = (tc as any).arguments;
              delete (tc as any).arguments;
            }
          }
        }
      }
    }
    return convs;
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (e) {
    console.error('[store] Failed to save conversations:', e);
    // 尝试清理后重试
    try {
      const cleaned = JSON.parse(JSON.stringify(convs));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // 静默失败，下次操作会重试
    }
  }
}

/** 粗略估算 token 数：中文约 1.5 字符/token，英文约 4 字符/token */
function estimateTokens(messages: Message[]): number {
  let chars = 2000; // system prompt 基础开销
  for (const m of messages) {
    chars += m.content.length;
    if (m.toolCalls) {
      for (const tc of m.toolCalls) {
        chars += JSON.stringify(tc.args).length;
        chars += (tc.result || tc.error || '').length;
      }
    }
  }
  // 中英文混合约 2.5 字符/token
  return Math.ceil(chars / 2.5);
}

function fmtTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

let conversations = loadConversations();

export function getConversations(filter?: 'active' | 'archived'): Conversation[] {
  const sorted = conversations.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  if (filter === 'archived') return sorted.filter(c => c.archived);
  if (filter === 'active') return sorted.filter(c => !c.archived);
  return sorted;
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.find((c) => c.id === id);
}

export function createConversation(title: string, model: string, workdir: string = ''): Conversation {
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title,
    model,
    workdir,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contextTokens: 0,
    archived: false,
  };
  conversations = [conv, ...conversations];
  saveConversations(conversations);
  return conv;
}

export function deleteConversation(id: string): void {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversations(conversations);
}

export function archiveConversation(id: string): void {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;
  conversations[idx] = { ...conversations[idx], archived: true, updatedAt: Date.now() };
  saveConversations(conversations);
}

export function restoreConversation(id: string): void {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;
  conversations[idx] = { ...conversations[idx], archived: false, updatedAt: Date.now() };
  saveConversations(conversations);
}

export function updateConversationWorkdir(id: string, workdir: string): void {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;
  conversations[idx] = { ...conversations[idx], workdir, updatedAt: Date.now() };
  saveConversations(conversations);
}

export function addMessage(convId: string, message: Message): void {
  const idx = conversations.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  const conv = conversations[idx];
  const newMessages = [...conv.messages, message];
  const title = message.role === 'user' && newMessages.filter((m) => m.role === 'user').length === 1
    ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
    : conv.title;
  conversations[idx] = { ...conv, messages: newMessages, title, updatedAt: Date.now(), contextTokens: estimateTokens(newMessages) };
  saveConversations(conversations);
}

export function updateMessage(convId: string, msgId: string, updates: Partial<Message>): void {
  const convIdx = conversations.findIndex((c) => c.id === convId);
  if (convIdx === -1) return;
  const conv = conversations[convIdx];
  const msgIdx = conv.messages.findIndex((m) => m.id === msgId);
  if (msgIdx === -1) return;
  const newMessages = [...conv.messages];
  newMessages[msgIdx] = { ...newMessages[msgIdx], ...updates };
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now(), contextTokens: estimateTokens(newMessages) };
  saveConversations(conversations);
}

export function updateToolCall(
  convId: string, msgId: string, toolCallId: string, updates: Partial<ToolCall>
): void {
  const convIdx = conversations.findIndex((c) => c.id === convId);
  if (convIdx === -1) return;
  const conv = conversations[convIdx];
  const msg = conv.messages.find((m) => m.id === msgId);
  if (!msg?.toolCalls) return;
  const tcIdx = msg.toolCalls.findIndex((t) => t.id === toolCallId);
  if (tcIdx === -1) return;
  const newToolCalls = [...msg.toolCalls];
  newToolCalls[tcIdx] = { ...newToolCalls[tcIdx], ...updates };
  const msgIdx = conv.messages.findIndex((m) => m.id === msgId);
  const newMessages = [...conv.messages];
  newMessages[msgIdx] = { ...newMessages[msgIdx], toolCalls: newToolCalls };
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now(), contextTokens: estimateTokens(newMessages) };
  saveConversations(conversations);
}

export function appendToMessage(convId: string, msgId: string, chunk: string): void {
  const convIdx = conversations.findIndex((c) => c.id === convId);
  if (convIdx === -1) return;
  const conv = conversations[convIdx];
  const msgIdx = conv.messages.findIndex((m) => m.id === msgId);
  if (msgIdx === -1) return;
  const newMessages = [...conv.messages];
  newMessages[msgIdx] = { ...newMessages[msgIdx], content: newMessages[msgIdx].content + chunk };
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now(), contextTokens: estimateTokens(newMessages) };
  saveConversations(conversations);
}
