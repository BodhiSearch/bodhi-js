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
import type { CreateChatCompletionRequest } from '@bodhiapp/bodhi-js-react/api';

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
): Promise<ApiResponseResult<TRes>>
```

### Simple GET Request

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function ModelList() {
  const { client } = useBodhi();
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    const result = await client.sendApiRequest('GET', '/v1/models');

    if (isApiResultSuccess(result)) {
      setModels(result.body.data);
    }
  };

  return <ul>{models.map(m => <li key={m.id}>{m.id}</li>)}</ul>;
}
```

### POST Request with Body

```typescript
import { CreateChatCompletionRequest, CreateChatCompletionResponse } from '@bodhiapp/ts-client';

const request: CreateChatCompletionRequest = {
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
};

const result = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', request);

if (isApiResultSuccess(result)) {
  console.log(result.body.choices[0].message.content);
}
```

## Response Handling

### ApiResponseResult Type

All API requests return `ApiResponseResult<T>`, which is a discriminated union:

```typescript
type ApiResponseResult<T> =
  | ApiResponse<T> // Success response
  | { error: OperationErrorResponse }; // Network/operation error

interface ApiResponse<T> {
  body: T; // Response data
  status: number; // HTTP status code
  headers?: Record<string, string>; // Response headers
}

interface OperationErrorResponse {
  message: string; // Error message
  type: string; // Error type
}
```

### Type Guards

Use type guards to handle responses safely:

```typescript
import { isApiResultSuccess, isApiResultError, isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultOperationError(result)) {
  // Network error, extension not available, etc.
  console.error('Operation error:', result.error.message);
  return;
}

if (isApiResultError(result)) {
  // HTTP 4xx/5xx error
  console.error(`HTTP ${result.status}:`, result.body);
  return;
}

if (isApiResultSuccess(result)) {
  // HTTP 2xx success
  console.log('Success:', result.body);
}
```

### Complete Error Handling Pattern

```typescript
async function fetchModels() {
  try {
    const result = await client.sendApiRequest('GET', '/v1/models');

    // Check for operation errors (network, extension, etc.)
    if (isApiResultOperationError(result)) {
      setError(`Connection error: ${result.error.message}`);
      return;
    }

    // Check HTTP status
    if (result.status >= 400) {
      setError(`Server error: ${result.status}`);
      return;
    }

    // Success
    setModels(result.body.data);
  } catch (err) {
    setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
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
function ProtectedChat() {
  const { client, isAuthenticated } = useBodhi();

  const sendMessage = async (prompt: string) => {
    if (!isAuthenticated) {
      throw new Error('Please login first');
    }

    const result = await client.sendApiRequest<
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

    if (isApiResultSuccess(result)) {
      return result.body.choices[0].message.content;
    }
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
const result = await client.sendApiRequest<void, { data: Model[] }>('GET', '/v1/models');

if (isApiResultSuccess(result)) {
  const models = result.body.data;
  console.log(
    'Available models:',
    models.map(m => m.id)
  );
}
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
const result = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', {
  model: 'gemma-3n-e4b-it',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
});

if (isApiResultSuccess(result)) {
  console.log(result.body.choices[0].message.content);
}
```

### Retrieve a Model

**Recommended (OpenAI-compatible):**

```typescript
const model = await client.models.retrieve('llama-3.2');
console.log(model.id, model.owned_by);
```

**Low-level alternative:**

```typescript
const result = await client.sendApiRequest<void, Model>('GET', '/v1/models/llama-3.2');

if (isApiResultSuccess(result)) {
  console.log(result.body.id, result.body.owned_by);
}
```

### Ping Server

```typescript
const result = await client.sendApiRequest<void, { message: string }>('GET', '/ping');

if (isApiResultSuccess(result)) {
  console.log('Server response:', result.body.message);
}
```

## MCP API

The SDK provides a namespaced API for interacting with MCP (Model Context Protocol) servers configured on the backend.

### List MCPs

```typescript
const { mcps } = await client.mcps.list();
for (const mcp of mcps) {
  console.log(mcp.id, mcp.tools_cache.length, 'cached tools');
}
```

Each `Mcp` object includes a `tools_cache` array with pre-loaded tools, so you can often avoid a separate `listTools()` call.

### List Tools for an MCP

```typescript
const { tools } = await client.mcps.listTools('my-mcp-server');
for (const tool of tools) {
  console.log(tool.name, '-', tool.description);
  console.log('Schema:', JSON.stringify(tool.input_schema));
}
```

### Refresh Tools

Re-discover tools from the MCP server and update the cache:

```typescript
const { tools } = await client.mcps.refreshTools('my-mcp-server');
console.log('Refreshed tools:', tools.map(t => t.name));
```

### Execute a Tool

```typescript
const result = await client.mcps.executeTool(
  'my-mcp-server',
  'search',
  { query: 'hello world' }
);
console.log('Tool result:', result);
```

### Complete MCP Example

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function McpTools() {
  const { client } = useBodhi();
  const [tools, setTools] = useState<{ name: string; description: string }[]>([]);

  const loadTools = async () => {
    const { mcps } = await client.mcps.list();
    if (mcps.length > 0) {
      const { tools } = await client.mcps.listTools(mcps[0].id);
      setTools(tools.map(t => ({ name: t.name, description: t.description })));
    }
  };

  const executeTool = async (mcpId: string, toolName: string) => {
    try {
      const result = await client.mcps.executeTool(mcpId, toolName, {});
      console.log('Result:', result);
    } catch (err) {
      console.error('Tool execution failed:', err);
    }
  };

  return (
    <div>
      <button onClick={loadTools}>Load Tools</button>
      <ul>
        {tools.map(t => (
          <li key={t.name}>{t.name}: {t.description}</li>
        ))}
      </ul>
    </div>
  );
}
```

## TypeScript Support

### Generic Type Parameters

```typescript
// Define request and response types
interface MyRequest {
  query: string;
}

interface MyResponse {
  results: string[];
}

const result = await client.sendApiRequest<MyRequest, MyResponse>('POST', '/custom-endpoint', { query: 'search term' });

// result is typed as ApiResponseResult<MyResponse>
if (isApiResultSuccess(result)) {
  // result.body is typed as MyResponse
  const results: string[] = result.body.results;
}
```

### Using OpenAI Types

```typescript
import { CreateChatCompletionRequest, CreateChatCompletionResponse, ChatCompletionRequestMessage } from '@bodhiapp/ts-client';

const messages: ChatCompletionRequestMessage[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' },
];

const result = await client.sendApiRequest<CreateChatCompletionRequest, CreateChatCompletionResponse>('POST', '/v1/chat/completions', { model: 'gemma-3n-e4b-it', messages });
```

## Error Scenarios

### Network Errors

```typescript
// Extension not available
{
  error: {
    message: 'Extension not detected',
    type: 'extension_error'
  }
}

// Server not reachable
{
  error: {
    message: 'Server not reachable',
    type: 'network_error'
  }
}

// Request timeout
{
  error: {
    message: 'Request timeout',
    type: 'timeout_error'
  }
}
```

### HTTP Errors

```typescript
// 401 Unauthorized
{
  status: 401,
  body: {
    error: {
      message: 'Unauthorized',
      type: 'invalid_request_error',
      code: 'unauthorized'
    }
  }
}

// 404 Not Found
{
  status: 404,
  body: {
    error: {
      message: 'Model not found',
      type: 'invalid_request_error',
      code: 'model_not_found',
      param: 'model'
    }
  }
}

// 500 Internal Server Error
{
  status: 500,
  body: {
    error: {
      message: 'Internal server error',
      type: 'server_error'
    }
  }
}
```

## Best Practices

### 1. Always Check Response Type

```typescript
// ❌ DON'T assume success
const result = await client.sendApiRequest('GET', '/v1/models');
console.log(result.body); // ERROR: body might not exist

// ✅ DO check with type guard
const result = await client.sendApiRequest('GET', '/v1/models');
if (isApiResultSuccess(result)) {
  console.log(result.body); // Safe
}
```

### 2. Handle Both Error Types

```typescript
// ❌ DON'T only handle HTTP errors
if (result.status >= 400) {
  // This won't catch network errors
}

// ✅ DO handle both operation and HTTP errors
if (isApiResultOperationError(result)) {
  // Network/extension error
} else if (result.status >= 400) {
  // HTTP error
} else {
  // Success
}
```

### 3. Use TypeScript Generics

```typescript
// ❌ DON'T use 'any'
const result = await client.sendApiRequest('GET', '/v1/models');

// ✅ DO specify types
const result = await client.sendApiRequest<void, ModelsResponse>('GET', '/v1/models');
```

### 4. Provide User Feedback

```typescript
function ApiCallButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await client.sendApiRequest('GET', '/endpoint');

      if (isApiResultOperationError(result)) {
        setError(result.error.message);
        return;
      }

      if (result.status >= 400) {
        setError(`Server error: ${result.status}`);
        return;
      }

      // Success...
    } catch (err) {
      setError('Unexpected error');
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
async function fetchWithRetry(endpoint: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await client.sendApiRequest('GET', endpoint);

    if (isApiResultOperationError(result)) {
      if (attempt === maxRetries) {
        throw new Error(result.error.message);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      continue;
    }

    return result;
  }
}
```

## Next Steps

- **[Streaming](./streaming.md)** - Learn about streaming API responses
- **[Error Handling](./error-handling.md)** - Deep dive into error patterns
- **[Client State](./client-state.md)** - Understanding connection modes

---

← Back to [Authentication](./authentication.md) | Continue to [Streaming](./streaming.md) →
