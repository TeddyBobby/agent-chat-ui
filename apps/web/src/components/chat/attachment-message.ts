export interface MessageAttachment {
  name: string;
  size: string;
  content: string;
}

export const BINARY_ATTACHMENT_PLACEHOLDER = '[二进制附件：当前仅展示文件名和大小，不读取内容]';

export const PREVIEWABLE_ATTACHMENT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'html', 'htm',
  'py', 'yaml', 'yml', 'toml', 'sh', 'bash', 'zsh', 'sql',
  'graphql', 'prisma', 'rs', 'go', 'java', 'c', 'cpp', 'h',
  'rb', 'php', 'swift', 'kt', 'dart', 'vue', 'svelte',
  'cfg', 'conf', 'ini', 'log', 'txt', 'env', 'gitignore',
  'xml', 'csv', 'svg', 'scss', 'less',
]);

const ATTACHMENT_END = '\n<!-- /attachment -->';

export function attachmentExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function isTextAttachment(name: string, mimeType = '') {
  if (mimeType.startsWith('text/')) return true;
  return PREVIEWABLE_ATTACHMENT_EXTENSIONS.has(attachmentExtension(name));
}

export function composeAttachmentMessage(
  visibleContent: string,
  files: MessageAttachment[],
) {
  if (files.length === 0) return visibleContent.trim();

  const fallback = `Attached ${files.length} file(s)`;
  const blocks = files.map((file) => {
    const params = new URLSearchParams({
      name: file.name,
      size: file.size,
      chars: String(file.content.length),
    });
    return `\n\n<!-- attachment:${params.toString()} -->\n${file.content}${ATTACHMENT_END}`;
  });

  return `${visibleContent.trim() || fallback}${blocks.join('')}`;
}

export function parseAttachments(content: string): {
  files: MessageAttachment[];
  cleanContent: string;
} {
  const current = parseLengthPrefixedAttachments(content);
  const legacy = parseLegacyAttachments(current.cleanContent);

  return {
    files: [...current.files, ...legacy.files],
    cleanContent: normalizeVisibleContent(legacy.cleanContent),
  };
}

export function visibleMessageText(content: string) {
  const currentMarker = content.indexOf('<!-- attachment:');
  const legacyMarker = content.search(/<!--\s*file:/);
  const markers = [currentMarker, legacyMarker].filter((index) => index >= 0);
  const boundary = markers.length > 0 ? Math.min(...markers) : content.length;
  return content.slice(0, boundary).trim();
}

function parseLengthPrefixedAttachments(content: string) {
  const files: MessageAttachment[] = [];
  const ranges: Array<[number, number]> = [];
  const header = /<!-- attachment:([^>\n]*) -->\n/g;
  let match: RegExpExecArray | null;

  while ((match = header.exec(content)) !== null) {
    const params = new URLSearchParams(match[1]);
    const name = params.get('name');
    const size = params.get('size');
    const chars = Number(params.get('chars'));
    const bodyStart = header.lastIndex;
    const bodyEnd = bodyStart + chars;

    if (!name || !size || !Number.isSafeInteger(chars) || chars < 0) continue;
    if (bodyEnd > content.length || !content.startsWith(ATTACHMENT_END, bodyEnd)) continue;

    files.push({ name, size, content: content.slice(bodyStart, bodyEnd) });
    ranges.push([match.index, bodyEnd + ATTACHMENT_END.length]);
    header.lastIndex = bodyEnd + ATTACHMENT_END.length;
  }

  return { files, cleanContent: removeRanges(content, ranges) };
}

function parseLegacyAttachments(content: string) {
  const files: MessageAttachment[] = [];
  const ranges: Array<[number, number]> = [];
  const header = /<!--\s*file:\s*(.+?)\s*\((.+?)\)\s*-->/g;
  const matches = [...content.matchAll(header)];

  matches.forEach((match, index) => {
    if (match.index === undefined) return;
    const bodyStart = match.index + match[0].length;
    const blockEnd = matches[index + 1]?.index ?? content.length;
    const block = content.slice(bodyStart, blockEnd);
    const opening = block.match(/^\s*\n```[^\n]*\n/);
    const closing = block.lastIndexOf('\n```');

    if (!opening || closing < opening[0].length) return;

    files.push({
      name: match[1].trim(),
      size: match[2].trim(),
      content: block.slice(opening[0].length, closing),
    });
    ranges.push([match.index, blockEnd]);
  });

  return { files, cleanContent: removeRanges(content, ranges) };
}

function removeRanges(content: string, ranges: Array<[number, number]>) {
  return [...ranges]
    .sort((left, right) => right[0] - left[0])
    .reduce((result, [start, end]) => result.slice(0, start) + result.slice(end), content);
}

function normalizeVisibleContent(content: string) {
  return content.replace(/\n{3,}/g, '\n\n').trim();
}
