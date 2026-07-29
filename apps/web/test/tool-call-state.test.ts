import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowToolCalls } from '../src/components/chat/tool-call-state.js';

test('running tool calls are visible without manual expansion', () => {
  assert.equal(shouldShowToolCalls(false, [{ status: 'running' }]), true);
});

test('completed tool calls remain user-expandable', () => {
  assert.equal(shouldShowToolCalls(false, [{ status: 'completed' }]), false);
  assert.equal(shouldShowToolCalls(true, [{ status: 'completed' }]), true);
});
