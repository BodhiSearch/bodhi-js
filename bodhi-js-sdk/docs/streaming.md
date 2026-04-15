# Streaming

Real-time streaming of LLM responses using AsyncGenerator pattern for optimal user experience.

## Overview

The Bodhi JS SDK provides built-in support for streaming API responses, particularly useful for chat completions where you want to display generated text as it arrives, creating a responsive, ChatGPT-like experience.

**Key Features**:

- AsyncGenerator pattern (`for await...of` loops)
- Server-Sent Events (SSE) under the hood
- Automatic chunk parsing
- Error handling in streams
- Works in both extension and direct mode
- TypeScript support with full type inference

## Quick Start

### Basic Streaming Chat

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function StreamingChat() {
  const { client } = useBodhi();
  const [response, setResponse] = useState('');

  const handleSubmit = async (model: string, prompt: string) => {
    setResponse('');

    const stream = client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      setResponse(prev => prev + content);
    }
  };

  return (
    <div>
      <input onSubmit={handleSubmit} />
      <div>{response}</div>
    </div>
  );
}
```

## chat.completions.create() Method

> **OpenAI SDK Familiarity**: If you've used the OpenAI SDK, this API will feel natural.
> Same pattern: `openai.chat.completions.create()` → `client.chat.completions.create()`

### Signature

```typescript
// Streaming
client.chat.completions.create(
  body: CreateChatCompletionRequest & { stream: true }
): AsyncGenerator<CreateChatCompletionStreamResponse>

// Non-streaming
client.chat.completions.create(
  body: CreateChatCompletionRequest & { stream?: false }
): Promise<CreateChatCompletionResponse>
```

> **Note**: For custom streaming endpoints beyond chat completions, use the generic `stream()` method. See [Advanced Streaming Patterns](./advanced/streaming-internals.md).

### Parameters

The method accepts a `CreateChatCompletionRequest` object with the following key parameters:

| Parameter     | Type                             | Description                                    |
| ------------- | -------------------------------- | ---------------------------------------------- |
| `model`       | `string`                         | Model ID (fetch dynamically from `/v1/models`) |
| `messages`    | `ChatCompletionRequestMessage[]` | Conversation messages with role and content    |
| `stream`      | `boolean?`                       | Enable streaming (default: false)              |
| `temperature` | `number?`                        | Sampling temperature (0-2)                     |
| `max_tokens`  | `number?`                        | Maximum tokens to generate                     |

Full list of parameters matches OpenAI's chat completion API.

### Return Type

When `stream: true`, returns an `AsyncGenerator` that yields `CreateChatCompletionStreamResponse` objects:

```typescript
interface CreateChatCompletionStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}
```

## Complete Streaming Example

```typescript
import { useState } from 'react';
import { useBodhi, BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

function Chat() {
  const { client } = useBodhi();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setStreaming(true);
    setResponse('');
    setError(null);

    try {
      // Use dynamically loaded model (see quick-start.md for model loading)
      const stream = client.chat.completions.create({
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        // Extract content from delta
        const content = chunk.choices?.[0]?.delta?.content || '';

        // Append to response
        setResponse(prev => prev + content);

        // Check for finish
        if (chunk.choices?.[0]?.finish_reason) {
          console.log('Finish reason:', chunk.choices[0].finish_reason);
        }
      }
    } catch (err) {
      if (err instanceof BodhiApiError) {
        setError(`HTTP ${err.status}: ${err.body.error.message}`);
      } else if (err instanceof BodhiError) {
        setError(`Connection error [${err.code}]: ${err.message}`);
      } else {
        setError('Unknown error occurred');
      }
    } finally {
      setStreaming(false);
      setPrompt('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        disabled={streaming}
        placeholder="Ask me anything..."
      />
      <button type="submit" disabled={streaming}>
        {streaming ? 'Generating...' : 'Send'}
      </button>

      {error && <div className="error">{error}</div>}
      {response && <div className="response">{response}</div>}
    </form>
  );
}
```

## Error Handling

Streaming methods (`stream()`, `chat.completions.create({ stream: true })`) throw `BodhiError` or `BodhiApiError` directly from iteration. Use `instanceof` to discriminate.

### Handling Stream Errors

```typescript
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

async function handleStream(model: string, prompt: string) {
  try {
    for await (const chunk of client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    })) {
      console.log(chunk.choices?.[0]?.delta?.content);
    }
  } catch (err) {
    if (err instanceof BodhiApiError) {
      // HTTP error during SSE (e.g. model not found, auth failure)
      console.error(`HTTP ${err.status}:`, err.body.error.message);
    } else if (err instanceof BodhiError) {
      // Operational error (extension not found, network failure, timeout)
      console.error(`Connection error [${err.code}]:`, err.message);
    } else {
      throw err; // Re-throw unexpected errors
    }
  }
}
```

### Common Stream Error Scenarios

```typescript
// Extension not available → BodhiError with code 'extension'
// HTTP 404: Model not found → BodhiApiError with status 404
// Network error → BodhiError with code 'network'
// Request timeout → BodhiError with code 'timeout'

import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

function describeStreamError(err: unknown): string {
  if (err instanceof BodhiApiError) {
    return `HTTP ${err.status}: ${err.body.error.message}`;
  }
  if (err instanceof BodhiError) {
    return `[${err.code}] ${err.message}`;
  }
  return 'Unknown error';
}
```

## Streaming with Authentication

```typescript
function AuthenticatedStream() {
  const { client, isAuthenticated } = useBodhi();

  const streamSecure = async (model: string, prompt: string) => {
    if (!isAuthenticated) {
      throw new Error('Authentication required');
    }

    // Authenticated requests are sent automatically when client has auth state
    const stream = client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      console.log(chunk.choices?.[0]?.delta?.content);
    }
  };

  return <button onClick={() => streamSecure(selectedModel, 'Hello')}>Stream</button>;
}
```

> **Advanced Streaming**: For custom streaming endpoints, debounced updates, batch state optimization, stream cancellation, and token counting, see [Advanced Streaming Patterns](./advanced/streaming-internals.md).

## Best Practices

### 1. Always Handle Errors

```typescript
// ❌ DON'T ignore errors
for await (const chunk of stream) {
  console.log(chunk);
}

// ✅ DO wrap in try-catch
try {
  for await (const chunk of stream) {
    console.log(chunk);
  }
} catch (err) {
  handleError(err);
}
```

### 2. Check for Undefined Content

```typescript
// ❌ DON'T assume content exists
const content = chunk.choices[0].delta.content;

// ✅ DO use optional chaining
const content = chunk.choices?.[0]?.delta?.content || '';
```

### 3. Clear State Before Streaming

```typescript
// ✅ Reset state before starting new stream
const handleSubmit = async () => {
  setResponse(''); // Clear previous response
  setError(null); // Clear previous error

  const stream = client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
  // ...
};
```

### 4. Show Loading State

```typescript
const [streaming, setStreaming] = useState(false);

const handleStream = async () => {
  setStreaming(true);
  try {
    // Stream...
  } finally {
    setStreaming(false);
  }
};

return <button disabled={streaming}>
  {streaming ? 'Streaming...' : 'Send'}
</button>;
```

## Next Steps

- **[Onboarding](./onboarding.md)** - Setup wizard integration
- **[Client State](./client-state.md)** - Connection mode management
- **[Error Handling](./error-handling.md)** - Comprehensive error patterns

---

← Back to [API Requests](./api-requests.md) | Continue to [Onboarding](./onboarding.md) →
