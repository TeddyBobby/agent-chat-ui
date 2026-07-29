import { isTerminalRunEvent, type Conversation, type Run, type RunEvent, type StartRunRequest } from "@pi-agent/contracts";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const conversationApi = {
  list: () => request<Conversation[]>("/v1/conversations"),
  get: (id: string) => request<Conversation>(`/v1/conversations/${encodeURIComponent(id)}`),
  create: (input: { title?: string; model: string; workdir?: string; id?: string }) =>
    request<Conversation>("/v1/conversations", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: { workdir?: string; archived?: boolean; model?: string }) =>
    request<Conversation>(`/v1/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  delete: (id: string) =>
    request<void>(`/v1/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  startRun: (conversationId: string, input: StartRunRequest) =>
    request<Run>(`/v1/conversations/${encodeURIComponent(conversationId)}/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  importLegacy: (conversations: Conversation[]) =>
    request<{ imported: string[] }>("/v1/import", {
      method: "POST",
      body: JSON.stringify({ conversations }),
    }),
};

export const credentialApi = {
  status: () => request<{ configured: boolean }>("/v1/credentials/api-key"),
  save: (apiKey: string) =>
    request<{ configured: boolean }>("/v1/credentials/api-key", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    }),
  logout: () =>
    request<{ configured: boolean }>("/v1/logout", { method: "POST" }),
};

export async function streamRunEvents(input: {
  runId: string;
  after: number;
  signal: AbortSignal;
  onEvent: (event: RunEvent) => void;
}) {
  let cursor = input.after;
  let retries = 0;
  while (!input.signal.aborted) {
    try {
      const response = await fetch(
        `${API_URL}/v1/runs/${encodeURIComponent(input.runId)}/events?after=${cursor}`,
        { signal: input.signal, headers: { Accept: "text/event-stream" } },
      );
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      retries = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!input.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
          if (!data) continue;
          const event = JSON.parse(data) as RunEvent;
          if (event.seq <= cursor) continue;
          if (event.seq !== cursor + 1) {
            void reader.cancel();
            throw new Error(`event sequence gap: expected ${cursor + 1}, received ${event.seq}`);
          }
          cursor = event.seq;
          input.onEvent(event);
          if (isTerminalRunEvent(event)) return;
        }
      }
      if (input.signal.aborted) return;
      throw new Error("event stream disconnected");
    } catch {
      if (input.signal.aborted) return;
      retries += 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** retries, 10_000)));
    }
  }
}
