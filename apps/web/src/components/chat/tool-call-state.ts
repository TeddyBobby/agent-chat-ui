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

export function getToolSummary(toolCalls: ToolSummaryItem[] | undefined) {
  const tools = toolCalls || [];
  const completed = tools.filter((tool) => tool.status !== 'running').length;
  const running = tools.find((tool) => tool.status === 'running');
  if (!running) return `${completed}/${tools.length} tools`;

  const action = TOOL_ACTIONS[running.name] || running.name;
  const target = running.args?.path
    ? String(running.args.path).split('/').pop()
    : running.args?.command
      ? String(running.args.command).slice(0, 40)
      : running.args?.pattern
        ? String(running.args.pattern)
        : '';
  return `Executing ${action}${target ? ` · ${target}` : ''} · ${completed}/${tools.length}`;
}
