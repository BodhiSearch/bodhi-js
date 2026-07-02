# Bodhi JS SDK — API Reference

Complete client API surface. All methods accessed via `client` from `useBodhi()`.

## Type Import Subpaths

The SDK exposes two subpath imports for API types (re-exports from `@bodhiapp/ts-client`):

```typescript
// Bodhi management API types (apps, MCPs, access requests, server info)
import type { ListMcpsResponse, BackendServerState } from '@bodhiapp/bodhi-js-react/api';

// OpenAI-compatible API types (chat, models, embeddings)
import type { ChatCompletionRequestMessage, CreateChatCompletionStreamResponse } from '@bodhiapp/bodhi-js-react/api/openai';
```

Same subpaths exist on all packages: `@bodhiapp/bodhi-js/api`, `@bodhiapp/bodhi-js-react-ext/api`, `@bodhiapp/bodhi-js-cli/api`, etc.

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

### client.mcps

```typescript
// List MCP servers (returns ListMcpsResponse with .mcps array)
// Each Mcp object includes path for proxy connection
const { mcps } = await client.mcps.list();

// Each mcp.path is a proxy endpoint (e.g. '/bodhi/v1/apps/mcps/{id}/mcp')
// Use createMcpClient() to connect:
import { createMcpClient } from '@bodhiapp/bodhi-js-react/mcp'; // or /bodhi-js-cli/mcp
const mcpClient = await createMcpClient(client, mcps[0].path);
const tools = await mcpClient.listTools();
await mcpClient.close();
```

MCP tool discovery and execution uses `@modelcontextprotocol/sdk` via `createMcpClient(client, mcp.path)`. See the MCP Client Factory section below.

## MCP Client Factory

### createMcpClient()

Creates a connected `@modelcontextprotocol/sdk` Client for a given MCP proxy path. Works with any Bodhi client type (UIClient, CliClient).

```typescript
import { createMcpClient } from '@bodhiapp/bodhi-js-react/mcp';     // Web/React
import { createMcpClient } from '@bodhiapp/bodhi-js-react-ext/mcp'; // Chrome extension
import { createMcpClient } from '@bodhiapp/bodhi-js-cli/mcp';       // CLI/headless

const mcpClient = await createMcpClient(
  client,          // UIClient or CliClient (any McpTransportProvider)
  mcp.path,        // MCP proxy path from Mcp.path (e.g. '/bodhi/v1/apps/mcps/{id}/mcp')
  options?: {
    name?: string,   // MCP client name (default: 'bodhi-mcp-client')
    version?: string // MCP client version (default: '1.0.0')
  }
);

// Returns @modelcontextprotocol/sdk Client — use standard MCP SDK methods:
const { tools } = await mcpClient.listTools();
const result = await mcpClient.callTool({ name: 'search', arguments: { query: 'AI' } });
await mcpClient.close();
```

> **Peer dependency**: Requires `@modelcontextprotocol/sdk` installed in your project.

### client.createMcpTransportConfig()

Low-level method for manual MCP transport setup. Prefer `createMcpClient()` for most cases.

```typescript
const config: McpTransportConfig = client.createMcpTransportConfig(mcp_path);
// config.url — Full URL for the MCP proxy endpoint
// config.fetch — Fetch function with auth token injection (Bearer for direct, extension relay for ext)

// Manual usage with @modelcontextprotocol/sdk:
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const transport = new StreamableHTTPClientTransport(config.url, { fetch: config.fetch });
```

### McpTransportConfig

```typescript
interface McpTransportConfig {
  url: URL; // Full URL for MCP proxy endpoint
  fetch: McpFetchLike; // Fetch with auth injection
}

type McpFetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;
```

### McpTransportProvider

```typescript
// Interface implemented by UIClient and CliClient
interface McpTransportProvider {
  createMcpTransportConfig(mcp_path: string): McpTransportConfig;
}
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
// Login — creates access request, opens user consent, then OAuth + PKCE
// This is the primary entry point. See SKILL.md for the full login flow explanation.
await client.login(options?: LoginOptions);

// LoginOptions — all fields optional:
interface LoginOptions {
  userRole?: UserScope;               // Default: 'scope_user_user'. Alternative: 'scope_user_power_user'
  requested?: RequestedResourcesV1;   // Resource envelope (version auto-injected by SDK)
  onProgress?: LoginProgressCallback; // (stage: 'requesting'|'reviewing') => void
}

// RequestedResourcesV1 — UI-driver flags (which consent controls to render) + slotted MCPs.
// Pass through only: the SDK adds no defaults; the backend decides what to show/grant.
interface RequestedResourcesV1 {
  models_access?: boolean;   // show model All/Specific access selector
  models_list?: boolean;     // show "list all models" toggle
  mcps_access?: boolean;     // show MCP All/Specific access selector
  mcps_list?: boolean;       // show "list all MCPs" toggle
  mcp_servers?: Array<{ url: string }>; // slotted by-url MCP requests
}

// LoginOptionsBuilder — fluent builder (recommended):
new LoginOptionsBuilder()
  .setRole('scope_user_power_user')   // requestedRole(scope: UserScope)
  .setModelsAccess()                  // .setModelsList() / .setMcpsAccess() / .setMcpsList()
  .addMcpServer('https://mcp.exa.ai/mcp') // adds to mcp_servers
  .build() // → LoginOptions

// AccessRequestBuilder — low-level builder (used by LoginOptionsBuilder):
import { AccessRequestBuilder } from '@bodhiapp/bodhi-js-react';
const body = new AccessRequestBuilder(appClientId)
  .requestedRole('scope_user_power_user')
  .modelsAccess()                        // .modelsList() / .mcpsAccess() / .mcpsList()
  .requested({ mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }] })
  .addMcpServer('http://localhost:3001')  // adds individual MCP server
  .build(); // → CreateAccessRequest

// Logout and clear tokens
await client.logout();

// Get current auth state
const auth = await client.getAuthState();
// auth: { status, user, accessToken, error }

// Low-level access request (login() wraps this automatically):
const result = await client.requestAccess(body: CreateAccessRequest);

// Single-step flow: login() builds the Keycloak authorize URL + error URL up front, sends the
// user through the Bodhi review page to Keycloak, and returns to your redirect_uri with the code.
// Web apps handle that final callback via BodhiProvider (or client.handleOAuthCallback(code, state)).
import { isWebUIClient } from '@bodhiapp/bodhi-js-react';
if (isWebUIClient(client)) {
  await client.handleOAuthCallback(code, state);
}
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

## Advanced Client Methods

```typescript
// Raw text stream — returns body as AsyncGenerator<string>
const { status, headers, body } = await client.streamText(
  method: string,
  endpoint: string,
  body?: unknown,
  headers?: Record<string, string>,
  auth?: boolean,
);
for await (const chunk of body) { /* chunk is a raw string */ }

// Extension ext2ext request — only valid in extension mode
import { isExtension } from '@bodhiapp/bodhi-js-react';
if (client.getConnectionMode() === 'extension') {
  const result = await client.sendExtRequest('ping', {});
}

// Async introspection — useful for debugging
const info = await client.debug(); // Record<string, unknown>

// Persistence — serialize current state for storage/restore
const snapshot = client.serialize();

// State change notifications — useful for CLI apps
client.setStateCallback((state) => {
  // Called whenever clientState or auth changes
  saveToStorage(client.serialize());
});
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
  refreshToken: string | null;
  expiresAt: number | null;    // unix ms timestamp
  isTokenRefresh: boolean;     // true when a token refresh is in flight
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

**Direct mode status derivation** — `status === 'direct-not-connected'` when any of:
`url === null`, or `server.status === 'not-reachable'` (probe failed), or `server.status === 'not-connected'` (never probed). Otherwise `'ready'`. This ensures consumers that auto-open setup via `status === 'direct-not-connected'` also trigger when setup-modal-v2's eager auto-probe fails against an offline server.

### BackendServerState

```typescript
{
  status: 'not-connected' | 'pending-extension-ready' | 'ready' | 'setup'
        | 'resource_admin' | 'error' | 'not-reachable';
  version: string | null;
  error: { message: string; type: string } | null;
  deployment?: 'standalone' | 'multi_tenant' | null;
  client_id?: string | null;
}
```

## Endpoints Reference

| Method | Endpoint                      | SDK Method                       |
| ------ | ----------------------------- | -------------------------------- |
| POST   | /v1/chat/completions          | client.chat.completions.create() |
| GET    | /v1/models                    | client.models.list()             |
| GET    | /v1/models/{id}               | client.models.retrieve(id)       |
| POST   | /v1/embeddings                | client.embeddings.create()       |
| GET    | /bodhi/v1/apps/mcps           | client.mcps.list()               |
| POST   | /bodhi/v1/apps/request-access | client.requestAccess()           |
| GET    | /bodhi/v1/info                | client.getServerState()          |

> **Note**: MCP tool operations (list tools, refresh, execute) are handled via `@modelcontextprotocol/sdk` using `createMcpClient(client, mcp.path)`.
