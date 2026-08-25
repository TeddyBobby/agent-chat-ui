export interface StreamRenderState {
  value: string;
  since: number;
}

/**
 * 流式渲染合并的固定间隔：markdown 管道（remark 解析 + rehype 语法高亮）
 * 对长回复非常昂贵，逐 token 重跑会导致明显卡顿。这里保证同一显示内容
 * 至少停留该时长，从而把重渲染频率从「每个 token」降到「每秒 ~33 次」。
 */
export const STREAM_RENDER_INTERVAL_MS = 30;

/**
 * 决定流式文本是否立即渲染，还是先保持当前内容、稍后重试。
 *
 * 语义与 `reconcileToolSummary` 一致：当前显示内容在 `since` 时间点之后
 * 至少保留 `STREAM_RENDER_INTERVAL_MS`，再切换到最新内容。若内容相同则
 * 直接返回当前视图（不触发任何更新）。
 */
export function reconcileStreamValue(
  current: StreamRenderState,
  desired: string,
  now: number,
): { view: StreamRenderState; retryIn?: number } {
  if (current.value === desired) {
    return { view: current };
  }

  const remaining = STREAM_RENDER_INTERVAL_MS - (now - current.since);
  if (remaining > 0) {
    return { view: current, retryIn: remaining };
  }

  return { view: { value: desired, since: now } };
}
