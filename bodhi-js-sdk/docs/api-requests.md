# API Requests

Learn how to make API calls to your local LLM server using the Bodhi JS SDK.

## Overview

The SDK provides a unified API for making HTTP requests to your local LLM server, whether through the browser extension or direct HTTP connection. All requests use the OpenAI-compatible API format.

## OpenAI-Compatible API (Recommended)

For common operations, use the namespaced API that mirrors the OpenAI SDK. This provides a familiar, type-safe interface with less boilerplate.

### List Models

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function ModelList() {
  const { client } = useBodhi();
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const modelList: string[] = [];
      for await (const model of client.models.list()) {
        modelList.push(model.id);
      }
      setModels(modelList);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  return <ul>{models.map(id => <li key={id}>{id}</li>)}</ul>;
}
```

### Chat Completions

```typescript
import type { CreateChatCompletionRequest } from '@bodhiapp/bodhi-js-react/api/openai';

// Non-streaming
async function sendChat(model: string, prompt: string) {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
}

// Streaming
async function sendStreamingChat(model: string, prompt: string) {
  const stream = client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content || '';
    console.log(content);
  }
}
```

### Embeddings

```typescript
async function createEmbedding(text: string) {
  const embedding = await client.embeddings.create({
    model: 'text-embedding-model',
    input: text,
  });
  return embedding.data[0].embedding;
}
```

> **Type Imports**: Import types from `@bodhiapp/bodhi-js-react/api` for cleaner imports. See [API Reference](./api-reference.md#importing-api-types) for details.

---

## Advanced: Low-Level API

For custom endpoints or advanced use cases, use the low-level `sendApiRequest` method.

## Basic API Request

### sendApiRequest Method

```typescript
async sendApiRequest<TReq, TRes>(
  method: string,              // HTTP method: 'GET', 'POST', etc.
  endpoint: string,            // API endpoint: '/v1/models', etc.
  body?: TReq,                 // Request body (optional)
  headers?: Record<string, string>,  // Custom headers (optional)
  authenticated?: boolean      // Include auth token (default: false)
): Promise<ApiResponse<TRes>>
```

Throws `BodhiError` on operational failures (network, timeout, extension). Returns `ApiResponse<TRes>` on any HTTP response. Use `unwrapResponse()` to extract the body and throw `BodhiApiError` on 4xx/5xx.

### Simple GET Request

```typescript
import { useBodhi, BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

function ModelList() {
  const { client } = useBodhi();
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await client.sendApiRequest('GET', '/v1/models');
      const body = unwrapResponse(response);
      setModels(body.data);
    } catch (err) {
      if (err instanceof BodhiApiError) {
        console.error(`HTTP ${err.status}:`, err.body.error.message);
      } else if (err instanceof BodhiError) {
        console.error(`Operational error [${err.code}]:`, err.message);
      }
    }
  };

  return <ul>{models.map(m => <li key={m.id}>{m.id}</li>)}</ul>;
}
```

### POST Request with Body

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from '@bodhiapp/bodhi-js-react/api/openai';

const request: CreateChatCompletionRequest = {
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
};

try {
  const response = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', request);
  const body = unwrapResponse(response);
  console.log(body.choices[0].message.content);
} catch (err) {
  if (err instanceof BodhiApiError) {
    console.error(`HTTP ${err.status}:`, err.body.error.message);
  } else if (err instanceof BodhiError) {
    console.error(`Operational error [${err.code}]:`, err.message);
  }
}
```

## Response Handling

### ApiResponse Type

`sendApiRequest` returns `ApiResponse<T>`, which wraps the HTTP response:

```typescript
interface ApiResponse<T> {
  body: T; // Response data
  status: number; // HTTP status code
  headers?: Record<string, string>; // Response headers
}
```

Operational failures (network, timeout, extension, auth) are thrown as `BodhiError` before a response is received. Use `unwrapResponse` to throw `BodhiApiError` on HTTP 4xx/5xx:

```typescript
function unwrapResponse<T>(response: ApiResponse<T>): T; // throws BodhiApiError on status >= 400
```

### Error Handling Pattern

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

try {
  const response = await client.sendApiRequest('GET', '/v1/models');
  const body = unwrapResponse(response); // throws BodhiApiError on 4xx/5xx
  console.log('Success:', body);
} catch (err) {
  if (err instanceof BodhiApiError) {
    // HTTP 4xx/5xx error
    console.error(`HTTP ${err.status}:`, err.body.error.message);
  } else if (err instanceof BodhiError) {
    // Network error, extension not available, timeout, auth failure
    console.error(`Operational error [${err.code}]:`, err.message);
  } else {
    throw err;
  }
}
```

### Complete Error Handling Pattern

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

async function fetchModels() {
  try {
    const response = await client.sendApiRequest('GET', '/v1/models');
    const body = unwrapResponse(response);
    setModels(body.data);
  } catch (err) {
    if (err instanceof BodhiApiError) {
      setError(`Server error ${err.status}: ${err.body.error.message}`);
    } else if (err instanceof BodhiError) {
      setError(`Connection error: ${err.message}`);
    } else {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

## Authenticated Requests

### Adding Authentication

Pass `authenticated: true` to automatically include the auth token:

```typescript
const result = await client.sendApiRequest(
  'GET',
  '/v1/protected-resource',
  undefined,
  undefined,
  true // authenticated = true
);
```

The SDK automatically adds the Authorization header:

```
Authorization: Bearer <access-token>
```

### Example: Protected Chat

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from '@bodhiapp/bodhi-js-react/api/openai';

function ProtectedChat() {
  const { client, isAuthenticated } = useBodhi();

  const sendMessage = async (prompt: string) => {
    if (!isAuthenticated) {
      throw new Error('Please login first');
    }

    const response = await client.sendApiRequest<
      CreateChatCompletionRequest,
      CreateChatCompletionResponse
    >(
      'POST',
      '/v1/chat/completions',
      {
        model: 'gemma-3n-e4b-it',
        messages: [{ role: 'user', content: prompt }],
      },
      undefined,
      true  // Include auth token
    );

    return unwrapResponse(response).choices[0].message.content;
  };

  return <ChatUI onSend={sendMessage} />;
}
```

## Custom Headers

### Adding Custom Headers

```typescript
const result = await client.sendApiRequest('POST', '/v1/chat/completions', requestBody, {
  'X-Custom-Header': 'value',
  'Content-Type': 'application/json',
});
```

### Conditional Headers

```typescript
const headers: Record<string, string> = {};

if (requiresSpecialHeader) {
  headers['X-Special'] = 'value';
}

const result = await client.sendApiRequest('GET', '/v1/resource', undefined, headers);
```

## Common API Endpoints

### List Models

**Recommended (OpenAI-compatible):**

```typescript
const modelList: string[] = [];
for await (const model of client.models.list()) {
  modelList.push(model.id);
}
console.log('Available models:', modelList);
```

**Low-level alternative:**

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { Model } from '@bodhiapp/bodhi-js-react/api/openai';

const response = await client.sendApiRequest<void, { data: Model[] }>('GET', '/v1/models');
const body = unwrapResponse(response);
console.log(
  'Available models:',
  body.data.map(m => m.id)
);
```

### Chat Completions (Non-Streaming)

**Recommended (OpenAI-compatible):**

```typescript
const response = await client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
});
console.log(response.choices[0].message.content);
```

**Low-level alternative:**

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from '@bodhiapp/bodhi-js-react/api/openai';

const response = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', {
  model: 'gemma-3n-e4b-it',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
});
console.log(unwrapResponse(response).choices[0].message.content);
```

### Retrieve a Model

**Recommended (OpenAI-compatible):**

```typescript
const model = await client.models.retrieve('llama-3.2');
console.log(model.id, model.owned_by);
```

**Low-level alternative:**

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { Model } from '@bodhiapp/bodhi-js-react/api/openai';

const response = await client.sendApiRequest<void, Model>('GET', '/v1/models/llama-3.2');
const model = unwrapResponse(response);
console.log(model.id, model.owned_by);
```

### Ping Server

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';

const response = await client.sendApiRequest<void, { message: string }>('GET', '/ping');
console.log('Server response:', unwrapResponse(response).message);
```

## MCP API

The SDK provides `client.mcps.list()` for listing MCP servers configured on the backend.

### List MCPs

```typescript
const { mcps } = await client.mcps.list();
for (const mcp of mcps) {
  console.log(mcp.id, mcp.slug, mcp.path);
}
```

For MCP tool discovery and execution, use `createMcpClient(client, mcp.path)` from `@bodhiapp/bodhi-js-react/mcp` (or the appropriate package variant). See [Advanced: MCP Agentic Patterns](./integration/advanced.md#mcp-agentic-patterns).

## TypeScript Support

### Generic Type Parameters

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';

// Define request and response types
interface MyRequest {
  query: string;
}

interface MyResponse {
  results: string[];
}

const response = await client.sendApiRequest<MyRequest, MyResponse>('POST', '/custom-endpoint', { query: 'search term' });
const body = unwrapResponse(response); // body is typed as MyResponse
const results: string[] = body.results;
```

### Using OpenAI Types

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse, ChatCompletionRequestMessage } from '@bodhiapp/bodhi-js-react/api/openai';

const messages: ChatCompletionRequestMessage[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' },
];

const response = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', { model: 'gemma-3n-e4b-it', messages });
const body = unwrapResponse(response);
```

## Error Scenarios

### Operational Errors (BodhiError)

Thrown before any HTTP response is received:

| `err.code`  | Cause                   |
| ----------- | ----------------------- |
| `extension` | Extension not available |
| `network`   | Server not reachable    |
| `timeout`   | Request timed out       |
| `auth`      | Authentication failed   |

### HTTP Errors (BodhiApiError)

Thrown by `unwrapResponse()` when status >= 400:

| `err.status` | `err.body.error.type`   | Cause                 |
| ------------ | ----------------------- | --------------------- |
| 401          | `invalid_request_error` | Unauthorized          |
| 404          | `invalid_request_error` | Resource not found    |
| 429          | `rate_limit_error`      | Too many requests     |
| 500          | `server_error`          | Internal server error |

Example BodhiApiError for 404:

```typescript
err.status === 404;
err.body ===
  {
    error: {
      message: 'Model not found',
      type: 'invalid_request_error',
      code: 'model_not_found',
      param: 'model',
    },
  };
```

## Best Practices

### 1. Always Use unwrapResponse

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-react';

// ❌ DON'T access body without checking status
const response = await client.sendApiRequest('GET', '/v1/models');
console.log(response.body); // Unsafe: body may be an error payload on 4xx

// ✅ DO use unwrapResponse — throws BodhiApiError on 4xx/5xx
const response = await client.sendApiRequest('GET', '/v1/models');
const body = unwrapResponse(response); // Safe
console.log(body);
```

### 2. Handle Both Error Classes

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

// ✅ Handle BodhiApiError (HTTP) and BodhiError (operational)
try {
  const body = unwrapResponse(await client.sendApiRequest('GET', '/v1/models'));
  // use body
} catch (err) {
  if (err instanceof BodhiApiError) {
    // HTTP error: err.status, err.body
  } else if (err instanceof BodhiError) {
    // Network/extension/timeout: err.code
  } else {
    throw err;
  }
}
```

### 3. Use TypeScript Generics

```typescript
// ❌ DON'T leave response untyped
const response = await client.sendApiRequest('GET', '/v1/models');

// ✅ DO specify types
const response = await client.sendApiRequest<void, ModelsResponse>('GET', '/v1/models');
```

### 4. Provide User Feedback

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

function ApiCallButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const body = unwrapResponse(await client.sendApiRequest('GET', '/endpoint'));
      // use body...
    } catch (err) {
      if (err instanceof BodhiApiError) {
        setError(`Server error ${err.status}: ${err.body.error.message}`);
      } else if (err instanceof BodhiError) {
        setError(`Connection error: ${err.message}`);
      } else {
        setError('Unexpected error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <Alert severity="error">{error}</Alert>}
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
    </div>
  );
}
```

### 5. Retry Failed Requests

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

async function fetchWithRetry(endpoint: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.sendApiRequest('GET', endpoint);
      return unwrapResponse(response);
    } catch (err) {
      if (err instanceof BodhiError && attempt < maxRetries) {
        // Retry on operational errors (network, timeout)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw err; // Give up on HTTP errors or last attempt
    }
  }
}
```

## Next Steps

- **[Streaming](./streaming.md)** - Learn about streaming API responses
- **[Error Handling](./error-handling.md)** - Deep dive into error patterns
- **[Client State](./client-state.md)** - Understanding connection modes

---

← Back to [Authentication](./authentication.md) | Continue to [Streaming](./streaming.md) →
