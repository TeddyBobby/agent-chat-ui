# 上下文管理方案

## 现状

- `contextTokens` 用 `字符总数 / 2.5` 估算，只展示不用
- `run()` 无截断，消息全量发给 LLM
- 超过 context window → LLM 报错

## 目标

LLM 收到的消息永远不超过模型上限，agent 不会因上下文溢出而崩溃。

## 设计

### 三条规则（优先级从高到低）

1. **System prompt 永远保留** — 这是 agent 的行为指令，丢掉等于废掉
2. **最近 N 对消息保留** — 保持对话连贯性
3. **剩余空间给历史** — 从旧到新填充，超出截断

### 截断位置

在 `core.ts` 的 `run()` 里，`callLLM()` 之前插入一个 `trimMessages()` 步骤：

```
用户消息 → buildPrompt → trimMessages → callLLM → ...
```

不修改 store，不影响前端显示。前端始终看到完整对话，只是发给 LLM 时裁剪。

### 两个策略

#### 策略 A：滑动窗口（默认）

简单粗暴，丢弃超出窗口的旧消息对。

```
[system] [msg1] [msg2] [msg3] ... [msgN] [user: 最新]
                                          ↑____保留____↑
```

- 保留 system prompt + 最后 N 轮
- 从旧到新截断，保证最新的消息完整

#### 策略 B：智能摘要（可选，未来扩展）

对超出窗口的旧消息调用 LLM 做摘要压缩：

```
[system] [摘要: msg1-msg3] [msg4] [msg5] [user: 最新]
           ↑
    旧消息压缩成一段摘要文本
```

这需要额外一次 LLM 调用，先不做。

### 实现步骤

**Step 1: `core.ts` 加 `trimMessages()`**

```ts
function trimMessages(
  messages: Message[],
  systemTokens: number,
  maxTokens: number,
  minKeep: number  // 最少保留几对消息
): Message[] {
  let used = systemTokens;
  const keep: Message[] = [];

  // 从后往前收集，保证最新消息完整
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateMsgTokens(messages[i]);
    if (used + cost > maxTokens && keep.length >= minKeep * 2) break;
    keep.unshift(messages[i]);
    used += cost;
  }
  return keep;
}
```

**Step 2: `AgentConfig` 加 `contextLimit`**

```ts
interface AgentConfig {
  contextLimit?: number;  // 不传就用默认（自动检测模型）
}
```

**Step 3: `route.ts` 传当前模型的 contextLimit**

从 `MODELS` 查找匹配模型的 `contextLimit`，传给 agent。

**Step 4: `estimateMsgTokens()` 精确化**

```ts
function estimateMsgTokens(msg: Message): number {
  let chars = msg.content.length;
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      chars += JSON.stringify(tc.args).length;
      chars += (tc.result || '').length;
    }
  }
  return Math.ceil(chars / 2.5) + 4; // +4 是 role 标记开销
}
```

### 边界处理

- **单条消息就超限**：截断该消息内容到 safe limit
- **工具结果巨大**：截断 `observation` 内容到 2000 字符（当前已有 5000 字符限制）
- **空对话**：不做任何处理
- **首次对话**：只有 system + 用户消息，必然不超限

### 不影响的部分

- 前端对话展示 → 始终完整
- store 存储 → 始终完整
- 上下文进度条 → 计算逻辑不变

### 不做的

- ❌ 自动摘要（需要额外 LLM 调用，先不做）
- ❌ 模型自动检测（用户选哪个模型就用哪个的限制）
- ❌ 用户手动清理上下文（后续可加按钮）
