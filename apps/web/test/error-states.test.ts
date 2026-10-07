import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import ErrorPage from '../src/app/error.js';
import GlobalErrorPage from '../src/app/global-error.js';

test('page error state is localized to Chinese and announced to screen readers', () => {
  const html = renderToStaticMarkup(createElement(ErrorPage, {
    error: Object.assign(new Error('boom'), { digest: 'abc123' }),
    reset: () => {},
  }));

  assert.match(html, /role="alert"/);
  assert.match(html, /页面出错了/);
  assert.match(html, /重试/);
  assert.doesNotMatch(html, /Something went wrong/);
  assert.doesNotMatch(html, /Try Again/);
});

test('global error state uses zh-CN document language and Chinese copy', () => {
  const html = renderToStaticMarkup(createElement(GlobalErrorPage, {
    error: Object.assign(new Error('boom'), { digest: 'abc123' }),
    reset: () => {},
  }));

  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /严重错误/);
  assert.match(html, /重新加载/);
  assert.doesNotMatch(html, /lang="en"/);
  assert.doesNotMatch(html, /Critical Error/);
});
