import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { MessageBubble } from '../src/components/chat/message-bubble.js';

test('the tool disclosure button exposes aria-expanded and aria-controls', () => {
  const html = renderToStaticMarkup(createElement(MessageBubble, {
    message: {
      id: 'message-1',
      role: 'assistant',
      content: '我来读取这个文件。',
      toolCalls: [
        { id: 'tool-1', name: 'read_file', args: { path: '/src/app.ts' }, status: 'completed' },
      ],
      timestamp: Date.now(),
    },
  }));

  // 折叠态默认关闭，且按钮与其控制的面板通过 id 关联。
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="tool-calls-message-1"/);
});

test('a message without tool calls renders no tool disclosure button', () => {
  const html = renderToStaticMarkup(createElement(MessageBubble, {
    message: {
      id: 'message-2',
      role: 'assistant',
      content: '已完成。',
      timestamp: Date.now(),
    },
  }));

  assert.doesNotMatch(html, /aria-controls="tool-calls-/);
  assert.doesNotMatch(html, /aria-expanded="false"/);
});
