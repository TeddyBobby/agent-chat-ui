import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDark } from '../src/components/theme-state.js';

test('explicit dark preference wins regardless of system theme', () => {
  assert.equal(resolveDark('dark', false), true);
  assert.equal(resolveDark('dark', true), true);
});

test('explicit light preference wins regardless of system theme', () => {
  assert.equal(resolveDark('light', true), false);
  assert.equal(resolveDark('light', false), false);
});

test('falls back to system preference when no explicit choice is stored', () => {
  assert.equal(resolveDark(null, true), true);
  assert.equal(resolveDark(null, false), false);
});
