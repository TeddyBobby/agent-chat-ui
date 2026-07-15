'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/chat/sidebar';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { Conversation, Message, ToolCall, MODELS } from '@/lib/types';
import {
  getConversations,
  createConversation,
  deleteConversation,
  addMessage,
  updateMessage,
  appendToMessage,
} from '@/lib/store';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [apiKey, setApiKey] = useState('');

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  const refreshConversations = useCallback(() => {
    setConversations([...getConversations()]);
  }, []);

  const handleNewChat = () => {
    const conv = createConversation('新对话', model);
    refreshConversations();
    setActiveId(conv.id);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    const conv = getConversations().find((c) => c.id === id);
    if (conv) setModel(conv.model);
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    if (activeId === id) setActiveId(null);
    refreshConversations();
  };

  const handleSend = async (content: string) => {
    let convId = activeId;
    if (!convId) {
      const conv = createConversation('新对话', model);
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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          apiKey: apiKey || undefined,
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
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];

            if (choice?.delta?.content) {
              appendToMessage(convId, assistantMsg.id, choice.delta.content);
              refreshConversations();
            }

            // Handle tool calls
            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existingTC = getConversations()
                  .find((c) => c.id === convId)
                  ?.messages.find((m) => m.id === assistantMsg.id)
                  ?.toolCalls?.find((t) => t.id === tc.id);

                if (!existingTC) {
                  // New tool call
                  const newTC: ToolCall = {
                    id: tc.id || crypto.randomUUID(),
                    name: tc.function?.name || 'unknown',
                    arguments: JSON.parse(tc.function?.arguments || '{}'),
                    status: 'running',
                  };
                  const msg = getConversations()
                    .find((c) => c.id === convId)
                    ?.messages.find((m) => m.id === assistantMsg.id);
                  if (msg) {
                    updateMessage(convId, assistantMsg.id, {
                      toolCalls: [...(msg.toolCalls || []), newTC],
                    });
                  }
                } else if (tc.function?.arguments) {
                  // Append to existing tool call arguments
                  existingTC.arguments = {
                    ...existingTC.arguments,
                    ...JSON.parse(tc.function.arguments),
                  };
                  const msg = getConversations()
                    .find((c) => c.id === convId)
                    ?.messages.find((m) => m.id === assistantMsg.id);
                  if (msg) {
                    updateMessage(convId, assistantMsg.id, { toolCalls: [...(msg.toolCalls || [])] });
                  }
                }
              }
              refreshConversations();
            }
          } catch {
            // Skip malformed JSON chunks
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

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
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
        <MessageList messages={activeConv?.messages || []} streaming={streaming} />
        <ChatInput
          onSend={handleSend}
          onModelChange={setModel}
          selectedModel={model}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          disabled={streaming}
        />
      </div>
    </div>
  );
}
