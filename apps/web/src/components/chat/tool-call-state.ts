const TOOL_ACTIONS: Record<string, string> = {
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  search_code: 'Search',
  run_command: 'Run',
};

interface ToolSummaryItem {
  name: string;
  status: string;
  args?: Record<string, unknown>;
}

export interface ToolSummarySnapshot {
  text: string;
  running: boolean;
}

export interface ToolSummaryView extends ToolSummarySnapshot {
  since: number;
}

const MIN_RUNNING_VISIBLE_MS = 400;
const TOOL_SWITCH_INTERVAL_MS = 200;

export function getToolSummary(toolCalls: ToolSummaryItem[] | undefined): string {
  return getToolSummarySnapshot(toolCalls, false).text;
}

export function getToolSummarySnapshot(
  toolCalls: ToolSummaryItem[] | undefined,
  taskRunning = false,
): ToolSummarySnapshot {
  const tools = toolCalls || [];
  const completed = tools.filter((tool) => tool.status !== 'running').length;
  const running = tools.find((tool) => tool.status === 'running');
  if (!running) {
    if (taskRunning && tools.length > 0) {
      return {
        text: `Processing tool results · ${completed}/${tools.length}`,
        running: true,
      };
    }
    return { text: `${completed}/${tools.length} tools`, running: false };
  }

  const action = TOOL_ACTIONS[running.name] || running.name;
  const target = running.args?.path
    ? String(running.args.path).split('/').pop()
    : running.args?.command
      ? String(running.args.command).slice(0, 40)
      : running.args?.pattern
        ? String(running.args.pattern)
        : '';
  return {
    text: `Executing ${action}${target ? ` · ${target}` : ''} · ${completed}/${tools.length}`,
    running: true,
  };
}

export function reconcileToolSummary(
  current: ToolSummaryView,
  desired: ToolSummarySnapshot,
  now: number,
): { view: ToolSummaryView; retryIn?: number } {
  if (current.text === desired.text && current.running === desired.running) {
    return { view: current };
  }

  if (current.running) {
    const minimum = desired.running ? TOOL_SWITCH_INTERVAL_MS : MIN_RUNNING_VISIBLE_MS;
    const remaining = minimum - (now - current.since);
    if (remaining > 0) return { view: current, retryIn: remaining };
  }

  return {
    view: { ...desired, since: now },
  };
}
