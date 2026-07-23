import { Conversation, Message, ToolCall } from './types';

// Simple in-memory store with localStorage persistence
const STORAGE_KEY = 'agent-chat-ui-conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

let conversations = loadConversations();

export function getConversations(): Conversation[] {
  return conversations;
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
  };
  conversations = [conv, ...conversations];
  saveConversations(conversations);
  return conv;
}

export function deleteConversation(id: string): void {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversations(conversations);
}

export function addMessage(convId: string, message: Message): void {
  const conv = conversations.find((c) => c.id === convId);
  if (!conv) return;
  conv.messages.push(message);
  conv.updatedAt = Date.now();
  // Auto-title from first user message
  if (message.role === 'user' && conv.messages.filter((m) => m.role === 'user').length === 1) {
    conv.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
  }
  saveConversations(conversations);
}

export function updateMessage(convId: string, msgId: string, updates: Partial<Message>): void {
  const conv = conversations.find((c) => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find((m) => m.id === msgId);
  if (!msg) return;
  Object.assign(msg, updates);
  conv.updatedAt = Date.now();
  saveConversations(conversations);
}

export function updateToolCall(
  convId: string,
  msgId: string,
  toolCallId: string,
  updates: Partial<ToolCall>
): void {
  const conv = conversations.find((c) => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find((m) => m.id === msgId);
  if (!msg?.toolCalls) return;
  const tc = msg.toolCalls.find((t) => t.id === toolCallId);
  if (!tc) return;
  Object.assign(tc, updates);
  conv.updatedAt = Date.now();
  saveConversations(conversations);
}

export function appendToMessage(convId: string, msgId: string, chunk: string): void {
  const conv = conversations.find((c) => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find((m) => m.id === msgId);
  if (!msg) return;
  msg.content += chunk;
  conv.updatedAt = Date.now();
  saveConversations(conversations);
}
