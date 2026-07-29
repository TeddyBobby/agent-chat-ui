# PiAgent v2 Architecture

## State ownership

SQLite is the source of truth for conversations, messages, tool calls, runs, and replayable run events. Browser storage is limited to UI preferences and a one-time legacy migration marker.

## Runtime modules

- `RunManager` owns task lifetime. Its interface is `start`, `get`, `cancel`, `replay`, and `subscribe`.
- `AppDatabase` atomically appends an event and updates the read projection used by conversation queries.
- `PiAgent` owns the model/tool loop and has no dependency on HTTP or React.
- The web client renders a server snapshot, applies ordered events, and reconnects with the last observed sequence.

## Run lifecycle

```text
queued -> running -> completed
                  -> failed
                  -> cancelling -> cancelled
```

The subscriber lifecycle is deliberately independent:

```text
connect -> replay(afterSeq) -> live events -> disconnect
```

Disconnecting never reaches the Agent abort controller. Only the explicit cancel command does.

## Event persistence invariant

For every event:

1. Allocate the next sequence number within the run.
2. Insert the event into `run_events`.
3. Update the message/tool-call projection in the same SQLite transaction.
4. Publish the committed event to live subscribers.

This makes replay idempotent and ensures a conversation snapshot always contains at least the state represented by its `activeRun.lastSeq`.

## Process failure

On server startup, orphaned `queued`, `running`, or `cancelling` records become `interrupted`. Resuming after a server process failure requires step checkpoints and tool idempotency and is intentionally separate from browser-refresh recovery.
