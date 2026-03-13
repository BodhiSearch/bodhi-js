# Bodhi JS SDK — API Reference

Complete client API surface. All methods accessed via `client` from `useBodhi()`.

## Namespaced APIs (OpenAI-Compatible)

### client.chat.completions

```typescript
// Streaming (returns AsyncGenerator)
const stream = client.chat.completions.create({
  model: string,
  messages: ChatCompletionRequestMessage[],
  stream: true,
  // Optional:
  temperature?: number,
  max_tokens?: number,
  tools?: ChatCompletionTools[],
  chat_template_kwargs?: Record<string, unknown>,
});

for await (const chunk of stream) {
  // chunk.choices[0].delta.content — text content
  // chunk.choices[0].delta.reasoning_content — thinking/reasoning (if model supports)
  // chunk.choices[0].delta.tool_calls — tool call chunks
  // chunk.choices[0].finish_reason — 'stop' | 'tool_calls' | null
}

// Non-streaming (returns Promise)
const response = await client.chat.completions.create({
  model: string,
  messages: ChatCompletionRequestMessage[],
  stream?: false,  // default
});
// response.choices[0].message.content — full response text
```

### client.models

```typescript
// List all models (AsyncGenerator — iterate with for-await)
for await (const model of client.models.list()) {
  model.id; // string — model identifier
  model.object; // 'model'
  model.created; // number — Unix timestamp
  model.owned_by; // string
}

// Get single model
const model = await client.models.retrieve('gemma-3n-e4b-it');
```

### client.embeddings

```typescript
const result = await client.embeddings.create({
  model: 'nomic-embed-text-v1.5',
  input: string | string[],
});
// result.data[0].embedding — number[] (float vector)
// result.model — string
// result.usage — { prompt_tokens, total_tokens }
```

### client.toolsets

```typescript
// List available toolsets
const toolsets = await client.toolsets.list();
// toolsets — ListToolsetsResponse

// Execute a tool
const result = await client.toolsets.executeTool(
  toolsetId: string,    // Toolset UUID
  toolName: string,     // Tool name within toolset
  params: Record<string, unknown>  // Tool parameters (auto-wrapped in { params: {...} })
);
```

### client.mcps

```typescript
// List MCP servers
const mcps = await client.mcps.list();
// mcps — ListMcpsResponse

// List tools for an MCP server
const tools = await client.mcps.listTools(mcpId: string);
// tools — McpToolsResponse

// Refresh tool list (re-discovers tools from MCP server)
const refreshed = await client.mcps.refreshTools(mcpId: string);

// Execute an MCP tool
const result = await client.mcps.executeTool(
  mcpId: string,
  toolName: string,
  params: Record<string, unknown>  // Auto-wrapped in { params: {...} }
);
```

## Generic API Methods

For endpoints not covered by namespaced APIs:

```typescript
// Typed request/response
const result = await client.sendApiRequest<RequestBody, ResponseBody>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,          // e.g., '/bodhi/v1/info'
  body?: RequestBody,
  headers?: Record<string, string>,
  authenticated?: boolean,   // Include auth token (default: false)
);
// Returns ApiResponseResult<ResponseBody>

// Generic streaming
const stream = client.stream<RequestBody, ChunkType>(
  method: string,
  endpoint: string,
  body?: RequestBody,
  headers?: Record<string, string>,
  authenticated?: boolean,
);
// Returns AsyncGenerator<ChunkType>
```

## Auth Methods

```typescript
// Initiate OAuth login (creates access request + review + OAuth in one flow)
await client.login(options?: LoginOptions);
// LoginOptions: { userRole?, requested?, flowType?, redirectUrl?, onProgress?, pollIntervalMs?, pollTimeoutMs? }
// See bodhi-sdk-advanced skill for full access request flow details

// Logout and clear tokens
await client.logout();

// Get current auth state
const auth = await client.getAuthState();
// auth: { status, user, accessToken, error }

// Request access (for access-controlled servers)
const result = await client.requestAccess(body: CreateAccessRequest);

// Poll for access approval
const status = await client.pollAccessRequestStatus(
  requestId: string,
  options?: { intervalMs?: number, timeoutMs?: number }
);
```

## Connection Mode Methods

```typescript
// Switch connection mode
await client.setConnectionMode('direct' | 'extension');

// Get current mode
client.getConnectionMode(); // 'direct' | 'extension' | null

// Test connectivity
const extState = await client.testExtensionConnectivity(timeoutMs?: number);
const directState = await client.testDirectConnectivity(serverUrl?: string);

// Get current state
const extState = await client.getExtensionState();
const directState = await client.getDirectState();
```

## Server Info

```typescript
// Ping server
const result = await client.pingApi();
// { body: { message: string }, status: 200 }

// Get server state
const state = await client.getServerState();
// BackendServerState: { status, version, error, deployment?, client_id? }
```

## Key Types

### ApiResponseResult<T>

```typescript
// Success
{ body: T; status: number; headers?: Record<string, string> }

// Error (operation-level: network, extension, timeout)
{ error: { message: string; type: string } }

// Type guards
import {
  isApiResultSuccess,        // Success response (2xx)
  isApiResultError,          // Server error response (4xx/5xx with body)
  isApiResultOperationError, // Operation error (network, extension)
} from '@bodhiapp/bodhi-js-react';
```

### AuthState

```typescript
{
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: { sub, email, name, given_name, family_name, preferred_username } | null;
  accessToken: string | null;
  error: { message: string; type: string } | null;
}

// Type guard
import { isAuthenticated } from '@bodhiapp/bodhi-js-react';
```

### ClientContextState (React)

```typescript
{
  status: 'not-initialized' | 'initializing' | 'extension-not-found' | 'direct-not-connected' | 'ready';
  mode: 'extension' | 'direct' | null;
  extensionId: string | null;
  url: string | null;
  server: BackendServerState;
  error: { message: string; type: string } | null;
}
```

### BackendServerState

```typescript
{
  status: 'not-connected' | 'pending-extension-ready' | 'ready' | 'setup'
        | 'resource_admin' | 'tenant_selection' | 'error' | 'not-reachable';
  version: string | null;
  error: { message: string; type: string } | null;
  deployment?: 'standalone' | 'multi_tenant' | null;
  client_id?: string | null;
}
```

## Endpoints Reference

| Method | Endpoint                                     | SDK Method                       |
| ------ | -------------------------------------------- | -------------------------------- |
| POST   | /v1/chat/completions                         | client.chat.completions.create() |
| GET    | /v1/models                                   | client.models.list()             |
| GET    | /v1/models/{id}                              | client.models.retrieve(id)       |
| POST   | /v1/embeddings                               | client.embeddings.create()       |
| GET    | /bodhi/v1/toolsets                           | client.toolsets.list()           |
| POST   | /bodhi/v1/toolsets/{id}/tools/{name}/execute | client.toolsets.executeTool()    |
| GET    | /bodhi/v1/mcps                               | client.mcps.list()               |
| GET    | /bodhi/v1/mcps/{id}/tools                    | client.mcps.listTools()          |
| POST   | /bodhi/v1/mcps/{id}/tools/refresh            | client.mcps.refreshTools()       |
| POST   | /bodhi/v1/mcps/{id}/tools/{name}/execute     | client.mcps.executeTool()        |
| GET    | /bodhi/v1/info                               | client.getServerState()          |
