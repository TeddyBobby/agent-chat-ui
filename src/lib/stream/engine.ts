/**
 * stream.ts — 流式渲染引擎（5 层架构）
 *
 * Layer 1: ConnectionManager — 指数退避 + 抖动 + 区分停止/断开
 * Layer 2: StreamBuffer — 半包缓冲 + 多字节安全解码
 * Layer 3: RequestDedup — 请求 ID 去重 + 顺序校验
 * Layer 4: BatchRenderer — 双指针 + RAF 批量更新
 * Layer 5: Store 对接 — 增量 append + 去重 refresh
 */

import { AgentEvent } from '@/lib/types';
import {
  getConversations,
  appendToMessage,
  updateMessage,
} from '@/lib/store';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'stopped';

export interface StreamCallbacks {
  onStatusChange: (status: StreamStatus) => void;
  onTick: () => void; // 触发 React 重渲染
}

// ═══════════════════════════════════════════════
// Layer 1: ConnectionManager
// ═══════════════════════════════════════════════

export class ConnectionManager {
  private retries = 0;
  private maxRetries = 3;
  private baseDelay = 1000;
  private maxDelay = 30000;
  private userAborted = false;

  reset() {
    this.retries = 0;
    this.userAborted = false;
  }

  abort() {
    this.userAborted = true;
  }

  /** 计算带抖动的延迟 */
  private backoff(): number {
    const exp = Math.min(this.baseDelay * Math.pow(2, this.retries), this.maxDelay);
    const jitter = exp * (0.75 + Math.random() * 0.5); // ±25%
    return Math.round(jitter);
  }

  async fetch(
    url: string,
    body: unknown,
    signal: AbortSignal
  ): Promise<Response> {
    while (this.retries <= this.maxRetries) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.reset();
        return res;
      } catch (e: any) {
        // 用户主动停止 — 不重试
        if (e.name === 'AbortError' || this.userAborted) {
          throw e;
        }
        this.retries++;
        if (this.retries > this.maxRetries) {
          throw new Error(`连接失败（已重试 ${this.maxRetries} 次）: ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, this.backoff()));
      }
    }
    throw new Error('unreachable');
  }
}

// ═══════════════════════════════════════════════
// Layer 2: StreamBuffer — SSE 解析 + 半包缓冲
// ═══════════════════════════════════════════════

export class StreamBuffer {
  private decoder = new TextDecoder();
  private buffer = '';

  reset() {
    this.buffer = '';
  }

  /** 喂入原始字节，返回已完成的 SSE 行 */
  feed(chunk: Uint8Array): string[] {
    // stream: true 确保多字节字符（中文/emoji）不被截断
    this.buffer += this.decoder.decode(chunk, { stream: true });

    const lines = this.buffer.split('\n');
    // 最后一段可能是不完整的行，保留在 buffer
    this.buffer = lines.pop() || '';

    return lines
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
  }

  /** 刷新残留，返回最后的不完整行 */
  flush(): string {
    const remainder = this.buffer;
    this.buffer = '';
    // 最后一次 decode 不带 stream 标记，确保所有字节被处理
    const final = this.decoder.decode();
    return remainder + final;
  }
}

// ═══════════════════════════════════════════════
// Layer 3: RequestDedup — 请求去重 + 顺序校验
// ═══════════════════════════════════════════════

export class RequestDedup {
  private currentRequestId: string | null = null;

  newRequest(): string {
    this.currentRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.currentRequestId;
  }

  isValid(requestId: string): boolean {
    return requestId === this.currentRequestId;
  }

  /** 是否是过期的请求 */
  isStale(requestId: string): boolean {
    return this.currentRequestId !== null && requestId !== this.currentRequestId;
  }
}

// ═══════════════════════════════════════════════
// Layer 4: BatchRenderer — RAF 批量更新
// ═══════════════════════════════════════════════

export class BatchRenderer {
  private pending: Array<{ convId: string; msgId: string; chunk: string }> = [];
  private rafId: number | null = null;
  private flushCb: () => void;

  constructor(flushCb: () => void) {
    this.flushCb = flushCb;
  }

  /** 追加文本块到待刷队列 */
  append(convId: string, msgId: string, chunk: string) {
    this.pending.push({ convId, msgId, chunk });
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }

  private flush() {
    if (this.pending.length === 0) return;

    // 合并同一 msgId 的连续块
    const batches = new Map<string, { convId: string; text: string }>();
    for (const p of this.pending) {
      const key = p.msgId;
      const existing = batches.get(key);
      if (existing) {
        existing.text += p.chunk;
      } else {
        batches.set(key, { convId: p.convId, text: p.chunk });
      }
    }
    this.pending = [];

    // 批量写入 store（一次只触发一次 save）
    for (const [msgId, { convId, text }] of batches) {
      appendToMessage(convId, msgId, text);
    }

    // 单次 flush 只触发一次 React 更新
    this.flushCb();
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// ═══════════════════════════════════════════════
// Layer 5: 主控制器 — 串联 1-4 层
// ═══════════════════════════════════════════════

export function createAgentStream(callbacks: StreamCallbacks) {
  const connection = new ConnectionManager();
  const buffer = new StreamBuffer();
  const dedup = new RequestDedup();
  const renderer = new BatchRenderer(callbacks.onTick);
  let abortController: AbortController | null = null;

  return {
    /** 发送消息并流式接收 */
    async send(params: {
      convId: string;
      assistantMsgId: string;
      messages: Array<{ role: string; content: string }>;
      model: string;
      apiKey: string;
      baseUrl?: string;
      workdir?: string;
    }) {
      const requestId = dedup.newRequest();
      abortController = new AbortController();
      connection.reset();
      buffer.reset();

      callbacks.onStatusChange('connecting');

      try {
        const res = await connection.fetch(
          '/api/chat',
          {
            messages: params.messages,
            model: params.model,
            apiKey: params.apiKey || '',
            baseUrl: params.baseUrl || undefined,
            workdir: params.workdir || undefined,
          },
          abortController.signal
        );

        callbacks.onStatusChange('streaming');

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 检查是否过期
          if (dedup.isStale(requestId)) {
            reader.cancel();
            break;
          }

          // Layer 2: 喂入缓冲区，得到 SSE 行
          const lines = buffer.feed(value);

          // Layer 3: 解析事件 + Layer 4: 入队 RAF 渲染
          for (const line of lines) {
            if (line === '[DONE]') continue;
            try {
              const event: AgentEvent = JSON.parse(line);
              this.handleEvent(event, params.convId, params.assistantMsgId);
              // tool_call 后 yield，让 React 渲染 running spinner
              if (event.type === 'tool_call') {
                await new Promise(r => requestAnimationFrame(r));
              }
            } catch {
              // skip malformed
            }
          }
        }

        // 刷新残留
        const tail = buffer.flush();
        if (tail && tail !== '[DONE]') {
          try {
            const event: AgentEvent = JSON.parse(tail);
            this.handleEvent(event, params.convId, params.assistantMsgId);
          } catch {}
        }

        callbacks.onStatusChange('idle');
      } catch (e: any) {
        if (e.name === 'AbortError') {
          callbacks.onStatusChange('stopped');
        } else {
          callbacks.onStatusChange('error');
          // 错误信息写入消息
          updateMessage(params.convId, params.assistantMsgId, {
            content: `❌ ${e.message || '连接失败'}`,
          });
          callbacks.onTick();
        }
      } finally {
        abortController = null;
        renderer.destroy();
      }
    },

    /** 处理单个 SSE 事件 */
    handleEvent(
      event: AgentEvent,
      convId: string,
      msgId: string
    ) {
      switch (event.type) {
        case 'text':
          // Layer 4: 入队 RAF 批量渲染
          renderer.append(convId, msgId, event.content);
          break;

        case 'tool_call': {
          const conv = getConversations().find((c) => c.id === convId);
          const msg = conv?.messages.find((m) => m.id === msgId);
          if (msg) {
            updateMessage(convId, msgId, {
              toolCalls: [
                ...(msg.toolCalls || []),
                {
                  id: event.id,
                  name: event.name,
                  args: event.args,
                  status: 'running' as const,
                },
              ],
            });
          }
          callbacks.onTick();
          break;
        }

        case 'tool_result': {
          const conv = getConversations().find((c) => c.id === convId);
          const msg = conv?.messages.find((m) => m.id === msgId);
          if (!msg?.toolCalls) break;

          const tcs = [...msg.toolCalls];
          const idx = tcs.findIndex((tc) => tc.id === event.id);
          if (idx === -1) {
            for (let i = tcs.length - 1; i >= 0; i--) {
              if (tcs[i].status === 'running') {
                tcs[i] = {
                  ...tcs[i],
                  status: event.error ? ('error' as const) : ('completed' as const),
                  result: event.result,
                  error: event.error,
                };
                updateMessage(convId, msgId, { toolCalls: tcs });
                break;
              }
            }
          } else {
            tcs[idx] = {
              ...tcs[idx],
              status: event.error ? ('error' as const) : ('completed' as const),
              result: event.result,
              error: event.error,
            };
            updateMessage(convId, msgId, { toolCalls: tcs });
          }
          callbacks.onTick();
          break;
        }

        case 'error':
          appendToMessage(convId, msgId, `\n\n❌ ${event.message}`);
          callbacks.onTick();
          break;

        case 'start':
        case 'done':
          break;
      }
    },

    /** 用户主动停止 */
    stop() {
      connection.abort();
      abortController?.abort();
      renderer.destroy();
    },

    destroy() {
      this.stop();
    },
  };
}
