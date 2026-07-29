export function shouldShowToolCalls(
  userExpanded: boolean,
  toolCalls: Array<{ status: string }> | undefined,
) {
  return userExpanded || Boolean(toolCalls?.some((tool) => tool.status === 'running'));
}
