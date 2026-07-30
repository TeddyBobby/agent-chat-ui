import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { MessageBubble } from '../src/components/chat/message-bubble.js';
import {
  BINARY_ATTACHMENT_PLACEHOLDER,
  composeAttachmentMessage,
  isTextAttachment,
  parseAttachments,
  visibleMessageText,
} from '../src/components/chat/attachment-message.js';

test('a markdown attachment with fenced code does not leak into visible message text', () => {
  const content = [
    '这是干嘛',
    '',
    '<!-- file: QUICK_START.md (4.8KB) -->',
    '```',
    '# 快速开始',
    '',
    '```bash',
    'curl http://localhost:8080/health',
    '```',
    '',
    '服务应该返回 ok。',
    '```',
  ].join('\n');

  const parsed = parseAttachments(content);

  assert.equal(parsed.cleanContent, '这是干嘛');
  assert.equal(parsed.files.length, 1);
  assert.match(parsed.files[0].content, /curl http:\/\/localhost:8080\/health/);
  assert.match(parsed.files[0].content, /服务应该返回 ok/);
});

test('the current attachment envelope round-trips arbitrary markdown content', () => {
  const attachment = {
    name: 'QUICK START (开发).md',
    size: '4.8KB',
    content: '# 标题\n\n```bash\ncurl localhost\n```\n\n<!-- /attachment -->',
  };
  const message = composeAttachmentMessage('帮我看看', [attachment]);
  const parsed = parseAttachments(message);

  assert.equal(parsed.cleanContent, '帮我看看');
  assert.deepEqual(parsed.files, [attachment]);
});

test('conversation titles hide both current and truncated legacy attachment markers', () => {
  assert.equal(visibleMessageText('帮我看看<!-- attachment:name=a.md'), '帮我看看');
  assert.equal(visibleMessageText('这是干嘛 <!-- file: QUICK_START.md (4.8KB) --> ``` #...'), '这是干嘛');
});

test('binary documents are metadata-only while text files remain previewable', () => {
  assert.equal(isTextAttachment('notes.md', 'text/markdown'), true);
  assert.equal(isTextAttachment('report.pdf', 'application/pdf'), false);
  assert.equal(
    isTextAttachment(
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
    false,
  );
  assert.match(BINARY_ATTACHMENT_PLACEHOLDER, /仅展示文件名和大小/);
});

test('a PDF message renders its icon and metadata without a content preview', () => {
  const content = composeAttachmentMessage('请保存这个附件', [{
    name: 'quarterly-report.pdf',
    size: '2.4MB',
    content: BINARY_ATTACHMENT_PLACEHOLDER,
  }]);
  const html = renderToStaticMarkup(createElement(MessageBubble, {
    message: {
      id: 'message-1',
      role: 'user',
      content,
      timestamp: Date.now(),
    },
  }));

  assert.match(html, />PDF</);
  assert.match(html, /quarterly-report\.pdf/);
  assert.match(html, /2\.4MB/);
  assert.doesNotMatch(html, /<pre/);
  assert.doesNotMatch(html, /二进制附件：当前仅展示/);
});
