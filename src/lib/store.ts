import { Conversation, Message, ToolCall } from './types';

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

function saveConversations(convs: Conversation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
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
  const idx = conversations.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  const conv = conversations[idx];
  const newMessages = [...conv.messages, message];
  const title = message.role === 'user' && newMessages.filter((m) => m.role === 'user').length === 1
    ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
    : conv.title;
  conversations[idx] = { ...conv, messages: newMessages, title, updatedAt: Date.now() };
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
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now() };
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
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now() };
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
  conversations[convIdx] = { ...conv, messages: newMessages, updatedAt: Date.now() };
  saveConversations(conversations);
}
