import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolSummary } from '../src/components/chat/tool-call-state.js';

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
