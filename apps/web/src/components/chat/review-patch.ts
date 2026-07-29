export function patchForReviewFile(patch: string, path: string) {
  if (!patch || !path) return '';

  const normalizedPath = reviewPath(path);
  const sections = patch
    .split(/(?=^diff --git )/m)
    .filter((section) => section.startsWith('diff --git '));

  return sections.filter((section) => {
    const diffHeader = section.split('\n', 1)[0];
    const headers = section.split('\n').filter((line) => line.startsWith('--- ') || line.startsWith('+++ '));
    return diffHeader === `diff --git a/${normalizedPath} b/${normalizedPath}`
      || headers.some((line) => (
      line === `--- a/${normalizedPath}`
      || line === `+++ b/${normalizedPath}`
      || line === `--- "${escapeGitPath(`a/${normalizedPath}`)}"`
      || line === `+++ "${escapeGitPath(`b/${normalizedPath}`)}"`
      ));
  }).join('\n');
}

export function reviewPath(path: string) {
  const marker = ' -> ';
  if (!path.includes(marker)) return path;

  const braceStart = path.indexOf('{');
  const braceEnd = path.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    const renamedPart = path.slice(braceStart + 1, braceEnd);
    const destination = renamedPart.split(marker).at(-1) || renamedPart;
    return `${path.slice(0, braceStart)}${destination}${path.slice(braceEnd + 1)}`;
  }

  return path.split(marker).at(-1)?.replace(/^{|}$/g, '') || path;
}

function escapeGitPath(path: string) {
  return path.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
