# Advanced Streaming Patterns

Advanced patterns for managing streaming chat completions.

> **Note**: Most applications can use `client.chat.completions.create({ stream: true })` directly. This guide covers advanced patterns for production use cases.

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
