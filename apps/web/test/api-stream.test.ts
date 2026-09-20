import assert from 'node:assert/strict';
import test from 'node:test';
import { streamRunEvents } from '../src/lib/api.js';
import type { RunEvent } from '@pi-agent/contracts';

// ── SSE stream fakes ──────────────────────────────────────────────────────

const encoder = new TextEncoder();

function frame(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** A Response whose body streams the given SSE frames and then closes. */
function sseResponse(frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of frames) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function event(seq: number, type: RunEvent['type'], extra: Record<string, unknown> = {}): RunEvent {
  return { runId: 'run-1', seq, type, createdAt: seq, ...extra } as RunEvent;
}

function collect(): { events: RunEvent[]; onEvent: (e: RunEvent) => void } {
  const events: RunEvent[] = [];
  return { events, onEvent: (e) => events.push(e) };
}

// ── Tests ────────────────────────────────────────────────────────────────

test('delivers SSE events in order and resolves on the terminal event', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    sseResponse([
      frame(event(1, 'run.started')),
      frame(event(2, 'assistant.delta', { content: 'hi' })),
      frame(event(3, 'run.completed')),
    ]),
  );

  const { events, onEvent } = collect();
  await streamRunEvents({
    runId: 'run-1',
    after: 0,
    signal: new AbortController().signal,
    onEvent,
  });

  assert.deepEqual(events.map((e) => e.seq), [1, 2, 3]);
});

test('skips events at or below the resume cursor during replay', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    sseResponse([
      frame(event(1, 'run.started')),
      frame(event(2, 'assistant.delta', { content: 'already seen' })),
      frame(event(3, 'run.completed')),
    ]),
  );

  const { events, onEvent } = collect();
  await streamRunEvents({
    runId: 'run-1',
    after: 2,
    signal: new AbortController().signal,
    onEvent,
  });

  assert.deepEqual(events.map((e) => e.seq), [3]);
});

test('reconnects after a sequence gap and resumes from the correct cursor', async (t) => {
  // First connection delivers an out-of-order event (seq 5 when 1 is expected),
  // forcing the client to detect the gap and reconnect. The second connection
  // replays the full, correct sequence.
  const responses = [
    sseResponse([frame(event(5, 'run.completed'))]),
    sseResponse([
      frame(event(1, 'run.started')),
      frame(event(2, 'assistant.delta', { content: 'hi' })),
      frame(event(3, 'run.completed')),
    ]),
  ];

  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    const response = responses.shift();
    if (!response) throw new Error('test exhausted its mocked responses');
    return response;
  });

  const { events, onEvent } = collect();
  await streamRunEvents({
    runId: 'run-1',
    after: 0,
    signal: new AbortController().signal,
    onEvent,
  });

  assert.equal(fetchCalls, 2, 'gap detection must trigger a reconnect');
  assert.deepEqual(events.map((e) => e.seq), [1, 2, 3]);
});

test('returns immediately without fetching when the signal is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch should not be called');
  }) as typeof fetch;

  try {
    const { events, onEvent } = collect();
    await streamRunEvents({
      runId: 'run-1',
      after: 0,
      signal: controller.signal,
      onEvent,
    });
    assert.deepEqual(events, []);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
});
