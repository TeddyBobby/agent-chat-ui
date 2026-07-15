import { NextRequest } from 'next/server';

// OpenAI-compatible chat streaming endpoint
// Supports OpenAI, Anthropic (via OpenAI-compatible API), DeepSeek, Ollama, etc.
export async function POST(req: NextRequest) {
  const { messages, model, apiKey, baseUrl } = await req.json();

  const apiBase = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const key = apiKey || process.env.OPENAI_API_KEY || '';

  if (!key) {
    return new Response(
      JSON.stringify({ error: 'API key is required. Set OPENAI_API_KEY or provide apiKey.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages,
      stream: true,
      // Enable tool use if the model supports it
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search query' } },
              required: ['query'],
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `API error: ${response.status} ${errorText}` }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Stream the response back to the client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Send done signal
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              controller.enqueue(new TextEncoder().encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
