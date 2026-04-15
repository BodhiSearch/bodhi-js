# Advanced Streaming Patterns

Advanced patterns for managing streaming chat completions and custom SSE endpoints.

> **Note**: Most applications can use `client.chat.completions.create({ stream: true })` directly. This guide covers advanced patterns for production use cases.

## Streaming Architecture

### Chat Completions SSE Parsing

`client.chat.completions.create({ stream: true })` returns an `AsyncGenerator` backed by SSE parsing in `core/src/openai-client-compat.ts`. Each yielded chunk is an OpenAI-compatible `ChatCompletionChunk` with `choices[].delta.content` (and `choices[].delta.tool_calls` for tool calls).

### Generic SSE Endpoint: client.stream()

Use `client.stream()` for custom SSE endpoints that return newline-delimited JSON:

```typescript
const stream = client.stream<MyResponseType>('/bodhi/v1/custom-stream', {
  method: 'POST',
  body: JSON.stringify({ param: 'value' }),
});

for await (const event of stream) {
  // event is MyResponseType
  console.log(event);
}
```

Returns `AsyncGenerator<TRes>`. Each SSE `data:` line is parsed as JSON and yielded as `TRes`.

### Raw Text Stream: client.streamText()

Use `client.streamText()` for endpoints that stream raw text (no SSE parsing):

```typescript
const result = await client.streamText('/bodhi/v1/raw-stream', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'Hello' }),
});

// result.text: string — full accumulated text
// result.chunks: string[] — individual chunks as received
console.log(result.text);
```

Returns `Promise<StreamTextResult>`.

### Tool-Call Accumulation

For agentic patterns where the LLM returns tool calls via streaming, the SDK accumulates deltas index-keyed across chunks:

```typescript
const stream = client.chat.completions.create({
  model: 'your-model',
  messages,
  tools,
  stream: true,
});

const toolCallDeltas: Record<number, any> = {};

for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta;
  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      // tc.index identifies which tool call this delta belongs to
      if (!toolCallDeltas[tc.index]) {
        toolCallDeltas[tc.index] = { id: tc.id, name: tc.function?.name, arguments: '' };
      }
      toolCallDeltas[tc.index].arguments += tc.function?.arguments || '';
    }
  }
}

// After stream ends, parse accumulated tool calls
const toolCalls = Object.values(toolCallDeltas).map(tc => ({
  ...tc,
  arguments: JSON.parse(tc.arguments),
}));
```

## Stream Cancellation

Implement cancellation using AbortController pattern for user-initiated stops.

### Basic Cancellation

```typescript
import { useRef } from 'react';
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function CancelableStream() {
  const { client } = useBodhi();
  const [response, setResponse] = useState('');
  const abortControllerRef = useRef<AbortController>();

  const startStream = async (model: string, prompt: string) => {
    setResponse('');

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const stream = client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        // Check if canceled
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Stream canceled by user');
          break;
        }

        const content = chunk.choices?.[0]?.delta?.content || '';
        setResponse(prev => prev + content);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error:', err);
      }
    }
  };

  const cancelStream = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <div>
      <button onClick={cancelStream}>Cancel Stream</button>
      <div className="response">{response}</div>
    </div>
  );
}
```

### Cancellation with Cleanup

```typescript
function StreamWithCleanup() {
  const { client } = useBodhi();
  const [streaming, setStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController>();

  const startStream = async (model: string, prompt: string) => {
    setStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      const stream = client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        // Process chunk...
      }
    } finally {
      // Cleanup always runs
      setStreaming(false);
      abortControllerRef.current = undefined;
    }
  };

  const cancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, []);

  return (
    <div>
      {streaming && <button onClick={cancelStream}>Cancel</button>}
    </div>
  );
}
```

## Best Practices

### Always Cleanup Resources

```typescript
useEffect(() => {
  return () => {
    // Cancel ongoing stream
    abortControllerRef.current?.abort();
  };
}, []);
```

### Handle All Error Cases

```typescript
try {
  const stream = client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
  for await (const chunk of stream) {
    // Process...
  }
} catch (err) {
  if (err instanceof Error) {
    // Parse error message
    const httpMatch = err.message.match(/^HTTP (\d+):/);
    if (httpMatch) {
      // HTTP error
      const status = parseInt(httpMatch[1]);
      console.error(`HTTP error ${status}`);
    } else if (err.message.includes('Network')) {
      // Network error
      console.error('Network error');
    } else if (err.name === 'AbortError') {
      // User canceled
      console.log('Stream canceled');
    } else {
      // Unknown error
      console.error('Stream error:', err.message);
    }
  }
}
```

---

## Next Steps

- [API Reference](../api-reference.md) - Complete API documentation
- [Streaming](../streaming.md) - Streaming basics and examples

---

← Back to [Streaming](../streaming.md) | Return to [Overview](../index.md)
