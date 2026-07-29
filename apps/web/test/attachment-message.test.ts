import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeAttachmentMessage,
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
