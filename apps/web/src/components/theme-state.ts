/**
 * 主题偏好解析：纯函数，方便单元测试。
 *
 * 优先级：显式用户选择 > 系统深色模式。只有用户从未手动切换过主题
 * （localStorage 里没有记录）时，才回退到系统的 prefers-color-scheme。
 */

export const THEME_STORAGE_KEY = "agent-chat-ui-theme";

export function resolveDark(
  stored: string | null,
  systemPrefersDark: boolean,
): boolean {
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return systemPrefersDark;
}
