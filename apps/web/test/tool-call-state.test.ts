import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getToolSummary,
  getToolSummarySnapshot,
  isToolDisclosureOpen,
  reconcileToolSummary,
  type ToolSummaryView,
} from '../src/components/chat/tool-call-state.js';

test('the collapsed summary names the currently running tool and target', () => {
  assert.equal(
    getToolSummary([
      { name: 'read_file', status: 'completed' },
      { name: 'edit_file', status: 'running', args: { path: '/project/src/page.tsx' } },
    ]),
    'Executing Edit · page.tsx · 1/2',
  );
});

test('the collapsed summary returns to progress after tools complete', () => {
  assert.equal(
    getToolSummary([
      { name: 'read_file', status: 'completed' },
      { name: 'edit_file', status: 'completed' },
    ]),
    '2/2 tools',
  );
});

test('completed tools keep showing task activity until the run actually ends', () => {
  assert.deepEqual(
    getToolSummarySnapshot([
      { name: 'read_file', status: 'completed' },
      { name: 'edit_file', status: 'completed' },
    ], true),
    {
      text: 'Processing tool results · 2/2',
      running: true,
    },
  );
});

test('a fast completion keeps the running summary visible for at least 400ms', () => {
  const running: ToolSummaryView = {
    text: 'Executing Read · page.tsx · 0/1',
    running: true,
    since: 1_000,
  };
  const transition = reconcileToolSummary(
    running,
    { text: '1/1 tools', running: false },
    1_050,
  );
  assert.deepEqual(transition.view, running);
  assert.equal(transition.retryIn, 350);
});

test('rapid tool changes are coalesced instead of changing every frame', () => {
  const current: ToolSummaryView = {
    text: 'Executing Read · page.tsx · 0/2',
    running: true,
    since: 1_000,
  };
  const transition = reconcileToolSummary(
    current,
    { text: 'Executing Edit · page.tsx · 1/2', running: true },
    1_080,
  );
  assert.deepEqual(transition.view, current);
  assert.equal(transition.retryIn, 120);
});

test('an expanded tool list collapses when the task ends', () => {
  const disclosure = { expanded: true, taskRunning: true };
  assert.equal(isToolDisclosureOpen(disclosure, true), true);
  assert.equal(isToolDisclosureOpen(disclosure, false), false);
});
