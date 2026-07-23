# 流式渲染引擎（五层架构）

前端 SSE 处理集中在 `src/lib/stream/engine.ts`，`page.tsx` 不再直接解析 SSE。

```
┌────────────────────────────────────────────────┐
│ Layer 1: ConnectionManager                     │
│ 指数退避重连 · 抖动防雪崩 · 区分停止/断开      │
├────────────────────────────────────────────────┤
│ Layer 2: StreamBuffer                          │
│ 半包/粘包缓冲 · TextDecoder 多字节安全          │
├────────────────────────────────────────────────┤
│ Layer 3: RequestDedup                          │
│ 请求 ID 去重 · 顺序校验 · 丢弃过期请求          │
├────────────────────────────────────────────────┤
│ Layer 4: BatchRenderer (RAF)                   │
│ requestAnimationFrame 批量更新                  │
├────────────────────────────────────────────────┤
│ Layer 5: createAgentStream 主控器               │
│ text → 入队渲染 · tool_call → 即时更新 · done   │
└────────────────────────────────────────────────┘
```

## Layer 1: ConnectionManager

指数退避 + 随机抖动，区分用户停止和网络断开。

```ts
class ConnectionManager {
  private retries = 0;
  private maxRetries = 3;
  private baseDelay = 1000;   // 1s → 2s → 4s → 8s (max 30s)

  private backoff(): number {
    const exp = Math.min(this.baseDelay * 2 ** this.retries, this.maxDelay);
    return Math.round(exp * (0.75 + Math.random() * 0.5)); // ±25% 抖动
  }

  async fetch(url, body, signal: AbortSignal) {
    while (this.retries <= this.maxRetries) {
      try {
        return await fetch(url, { method: 'POST', body: JSON.stringify(body), signal });
      } catch (e) {
        if (e.name === 'AbortError') throw e;  // 用户停止，不重试
        this.retries++;
        if (this.retries > this.maxRetries) throw e;
        await new Promise(r => setTimeout(r, this.backoff()));
      }
    }
  }
}
```

## Layer 2: StreamBuffer

buffer 累积处理 TCP 半包/粘包，`TextDecoder({stream:true})` 防止中文 emoji 被截断。

```ts
class StreamBuffer {
  private decoder = new TextDecoder();
  private buffer = '';

  feed(chunk: Uint8Array): string[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';  // 不完整行保留
    return lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6));
  }
}
```

## Layer 3: RequestDedup

每次请求生成唯一 ID，处理时校验是否过期。过期请求 cancel reader + 丢弃数据。

```ts
class RequestDedup {
  private currentRequestId: string | null = null;

  newRequest() {
    this.currentRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.currentRequestId;
  }

  isStale(requestId: string) {
    return this.currentRequestId !== null && requestId !== this.currentRequestId;
  }
}
```

## Layer 4: BatchRenderer (RAF)

文本块入队，同一帧内合并同 msgId 的连续块，一次 store 写入 + 一次 React 重渲染。

```ts
class BatchRenderer {
  private pending: Array<{ convId, msgId, chunk }> = [];
  private rafId: number | null = null;

  append(convId, msgId, chunk) {
    this.pending.push({ convId, msgId, chunk });
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();  // 合并 → appendToMessage → onTick
      });
    }
  }

  private flush() {
    const batches = new Map<string, string>();
    for (const p of this.pending) {
      batches.set(p.msgId, (batches.get(p.msgId) || '') + p.chunk);
    }
    this.pending = [];
    for (const [msgId, text] of batches) appendToMessage(convId, msgId, text);
    this.onTick();
  }
}
```

## Layer 5: createAgentStream 主控器

串联四层 + SSE 事件分发。`page.tsx` 只需调用 `stream.send()`：

```ts
const stream = createAgentStream({
  onTick: () => { setTick(t => t + 1); refreshConversations(); },
});
stream.send({ convId, assistantMsgId, messages, model, apiKey, baseUrl, workdir });
stream.stop();  // 用户主动停止
```

多会话并发：每会话独立 stream Map，只禁用运行中的会话输入框。

## 运行中工具可见性

工具执行通常在 1-2ms 内完成，需要两端 yield 才能看到 running spinner：

```ts
// 服务端 — emit action 后等 50ms 再执行工具
this.emit({ type: "action", ... });
await new Promise(r => setTimeout(r, 50));
const result = await tool.run(args);

// 客户端 — 收到 tool_call 后 RAF yield
if (event.type === 'tool_call') await new Promise(r => requestAnimationFrame(r));
```
