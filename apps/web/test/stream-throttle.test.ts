import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileStreamValue,
  STREAM_RENDER_INTERVAL_MS,
  type StreamRenderState,
} from '../src/components/chat/stream-throttle.js';

const state = (value: string, since: number): StreamRenderState => ({ value, since });

test('emits the first streamed content immediately when enough time has passed', () => {
  assert.deepEqual(
    reconcileStreamValue(state('', 0), 'H', 1_000),
    { view: state('H', 1_000) },
  );
});

test('holds rapid deltas within the coalescing interval', () => {
  const transition = reconcileStreamValue(state('H', 1_000), 'He', 1_010);
  assert.deepEqual(transition.view, state('H', 1_000));
  assert.equal(transition.retryIn, STREAM_RENDER_INTERVAL_MS - 10);
});

test('switches to the latest content once the interval elapses', () => {
  assert.deepEqual(
    reconcileStreamValue(state('H', 1_000), 'He', 1_000 + STREAM_RENDER_INTERVAL_MS),
    { view: state('He', 1_000 + STREAM_RENDER_INTERVAL_MS) },
  );
});

test('identical content does not schedule an update', () => {
  assert.deepEqual(
    reconcileStreamValue(state('Hello', 1_000), 'Hello', 1_005),
    { view: state('Hello', 1_000) },
  );
});

test('a large jump flushes immediately even if the interval has not fully elapsed', () => {
  const current = state('He', 1_000);
  const transition = reconcileStreamValue(current, 'Hello world', 1_000 + STREAM_RENDER_INTERVAL_MS + 1);
  assert.deepEqual(transition.view, { value: 'Hello world', since: 1_000 + STREAM_RENDER_INTERVAL_MS + 1 });
  assert.equal(transition.retryIn, undefined);
});
