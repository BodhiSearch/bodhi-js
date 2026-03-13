---
name: bodhi-sdk-advanced
description: >
  Advanced bodhi-js-sdk patterns: MCP tool integration, toolsets, access request flows (popup/redirect),
  multi-tenant awareness, dependency injection, custom clients, and generic API usage. Use for non-standard SDK integration scenarios.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm:*), Bash(npx:*)
---

# Bodhi JS SDK — Advanced Patterns

Deep-dive patterns for MCP integration, toolsets, access request flows, multi-tenant awareness, custom client configuration, and generic API access. For standard React integration, see the `bodhi-sdk` skill.

## MCP Tool Integration

MCP (Model Context Protocol) servers provide tools that extend LLM capabilities. The SDK provides a full CRUD + execution API.

### Listing MCP Servers

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function McpPanel() {
  const { client } = useBodhi();
  const [mcps, setMcps] = useState([]);

  useEffect(() => {
    client.mcps.list().then(setMcps);
  }, []);

  return (
    <ul>
      {mcps.map(mcp => (
        <li key={mcp.id}>
          {mcp.name} — {mcp.status}
        </li>
      ))}
    </ul>
  );
}
```

### Discovering MCP Tools

```tsx
const tools = await client.mcps.listTools(mcpId);
// tools contains tool definitions with name, description, parameters schema

// Refresh tool list (re-discovers from MCP server)
const refreshed = await client.mcps.refreshTools(mcpId);
```

### Executing MCP Tools

```tsx
const result = await client.mcps.executeTool(mcpId, 'search_documents', { query: 'machine learning', limit: 10 });
// params are auto-wrapped in { params: {...} } by the SDK
```

### MCP + Chat Integration (Tool Calling)

Use MCP tools as chat completion tools for agentic workflows:

```tsx
// 1. Get available tools
const mcpTools = await client.mcps.listTools(mcpId);

// 2. Convert to chat completion tool format
const tools = mcpTools.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// 3. Send chat with tools
const stream = client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: conversationHistory,
  tools,
  stream: true,
});

// 4. Handle tool calls in response
for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta;
  if (delta?.tool_calls) {
    // Accumulate tool call arguments across chunks
    // When complete, execute: client.mcps.executeTool(mcpId, toolName, args)
    // Then append tool result to messages and continue conversation
  }
}
```

## Toolset Integration

Toolsets are server-managed tool collections (different from MCP — these are built into the Bodhi App server).

```tsx
// List available toolsets
const toolsets = await client.toolsets.list();

// Execute a tool
const result = await client.toolsets.executeTool(
  toolsetId, // UUID of the toolset
  'run_query', // Tool name
  { sql: 'SELECT * FROM users LIMIT 10' }
);
// params auto-wrapped in { params: {...} }
```

### Endpoints

| Method | Endpoint                                     | SDK Method                    |
| ------ | -------------------------------------------- | ----------------------------- |
| GET    | /bodhi/v1/toolsets                           | client.toolsets.list()        |
| POST   | /bodhi/v1/toolsets/{id}/tools/{name}/execute | client.toolsets.executeTool() |
| GET    | /bodhi/v1/mcps                               | client.mcps.list()            |
| GET    | /bodhi/v1/mcps/{id}/tools                    | client.mcps.listTools()       |
| POST   | /bodhi/v1/mcps/{id}/tools/refresh            | client.mcps.refreshTools()    |
| POST   | /bodhi/v1/mcps/{id}/tools/{name}/execute     | client.mcps.executeTool()     |

## Access Request Flow

The access request is part of the **standard login flow** — every `login()` call creates an access request, has it reviewed, and then uses the granted scope for OAuth authentication. The SDK's `login()` method orchestrates this entire flow as a single call.

### How login() Works

The `login()` method is the primary entry point. It:

1. Creates an access request via `POST /bodhi/v1/apps/request-access`
2. Opens the admin review UI (popup or redirect)
3. Polls for approval (popup flow) or waits for redirect back
4. On approval, performs OAuth 2.0 + PKCE authentication with the granted scope
5. Returns `AuthState` with authenticated user

### LoginOptions

```typescript
import type { LoginOptions } from '@bodhiapp/bodhi-js-react';

const options: LoginOptions = {
  // Role to request (default: 'scope_user_user')
  userRole: 'scope_user_user',

  // Specific resources to request access to
  requested: {
    toolset_types: [{ toolset_type: 'code_interpreter' }],
    mcp_servers: [{ url: 'https://mcp.example.com' }],
  },

  // 'popup' (default) or 'redirect'
  flowType: 'popup',

  // For redirect flow only — where to return after review
  redirectUrl: 'http://localhost:3000/callback',

  // Progress callback — track flow stages
  onProgress: stage => {
    // stage: 'requesting' → 'reviewing' → 'authenticating'
    console.log('Login stage:', stage);
  },

  // Polling config (popup flow)
  pollIntervalMs: 2000, // default: 2000ms
  pollTimeoutMs: 300_000, // default: 300,000ms (5 minutes)
};
```

### Popup Flow (Default)

The popup flow opens the admin review page in a new window and polls for approval in the background. The user stays on your page.

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function LoginWithAccessRequest() {
  const { login, isReady, canLogin } = useBodhi();
  const [stage, setStage] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      await login({
        flowType: 'popup',
        onProgress: setStage,
        // Request specific resources
        requested: {
          toolset_types: [{ toolset_type: 'code_interpreter' }],
        },
      });
      // Success — auth state updated automatically
    } catch (err) {
      // 'Access request was denied or expired' or timeout
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handleLogin} disabled={!canLogin}>
        {stage ? `Login (${stage})...` : 'Login'}
      </button>
    </div>
  );
}
```

### Redirect Flow

The redirect flow navigates the user to the admin review page. After review, the admin redirects back to your app. You must handle the return with `handleAccessRequestCallback`.

**Important**: BodhiProvider does NOT auto-handle access request redirect callbacks (only OAuth callbacks are auto-handled). You must detect and handle the return yourself.

```tsx
import { useBodhi, isWebUIClient } from '@bodhiapp/bodhi-js-react';

function LoginWithRedirect() {
  const { client, login } = useBodhi();

  const handleLogin = async () => {
    await login({
      flowType: 'redirect',
      redirectUrl: `${window.location.origin}/callback`,
    });
    // Page navigates away — login() never resolves
  };

  return <button onClick={handleLogin}>Login</button>;
}

// Handle the redirect return (e.g., in your callback route)
function CallbackHandler() {
  const { client } = useBodhi();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('request_id');

    if (requestId && isWebUIClient(client)) {
      // Access request redirect callback
      client.handleAccessRequestCallback(requestId).catch(console.error);
    }
    // OAuth callbacks are handled automatically by BodhiProvider
  }, [client]);

  return <div>Processing...</div>;
}
```

### AccessRequestBuilder (Low-Level)

For direct control without `login()`, use `AccessRequestBuilder` and the underlying methods:

```typescript
import { AccessRequestBuilder, isApiResultSuccess } from '@bodhiapp/bodhi-js-react';

// Build the request body
const body = new AccessRequestBuilder(authClientId)
  .flowType('popup')
  .requestedRole('scope_user_user')
  .requested({
    toolset_types: [{ toolset_type: 'code_interpreter' }],
    mcp_servers: [{ url: 'https://mcp.example.com' }],
  })
  .build();

// Submit
const result = await client.requestAccess(body);
if (isApiResultSuccess(result)) {
  const { id: requestId, review_url: reviewUrl } = result.body;

  // Poll for approval
  const status = await client.pollAccessRequestStatus(requestId, {
    intervalMs: 2000,
    timeoutMs: 300_000,
  });
  // status.status === 'approved', status.access_request_scope contains granted scope
}
```

### Access Request Status Values

| Status     | Meaning                          |
| ---------- | -------------------------------- |
| `draft`    | Created, pending review          |
| `pending`  | Under admin review               |
| `approved` | Approved — proceed to OAuth      |
| `denied`   | Admin denied the request         |
| `failed`   | Processing error                 |
| `expired`  | Request timed out without review |

### Progress Stages

The `onProgress` callback reports three stages during `login()`:

1. **`requesting`** — Creating the access request (POST to server)
2. **`reviewing`** — Waiting for admin to approve (popup open or redirect)
3. **`authenticating`** — Access approved, performing OAuth 2.0 + PKCE

## Multi-Tenant Awareness

When `BackendServerState.deployment === 'multi_tenant'`, the server requires tenant selection before use.

### Detecting Multi-Tenant

```tsx
const { clientState } = useBodhi();

if (clientState.server.status === 'tenant_selection') {
  // Server is multi-tenant, user needs to select a tenant
  // clientState.server.deployment === 'multi_tenant'
}
```

### Server States Flow

```
not-reachable → ready (standalone)
not-reachable → tenant_selection → ready (multi-tenant, after selection)
not-reachable → setup (first-time server configuration)
not-reachable → resource_admin (admin approval required)
```

### Handling Tenant Selection

The setup wizard (`showSetup()`) handles tenant selection UI automatically. When a server is in `tenant_selection` state, calling `showSetup()` opens the onboarding modal which guides the user through tenant selection. After selection, the server transitions to `ready` state.

```tsx
const { clientState, showSetup, isOverallReady } = useBodhi();

if (clientState.server.status === 'tenant_selection') {
  // Setup wizard handles the tenant selection UI
  showSetup();
}
```

The `BackendServerState` includes `client_id` field — the active tenant's OAuth client_id after selection. This is set automatically by the SDK after the setup wizard completes.

## Dependency Injection (Custom Clients)

Use `@bodhiapp/bodhi-js-react-core` for full control over client creation:

```tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';

// Your custom client implementing UIClient interface
const customClient = createMyClient();

<BodhiProvider client={customClient}>
  <App />
</BodhiProvider>;
```

`react-core` depends only on `core` interfaces — it never imports `web` or `ext` packages. This enables:

- Custom client implementations
- Testing with mock clients
- Framework-agnostic integration
- Wrapping third-party API clients

### Package Dependency Graph

```
@bodhiapp/bodhi-js-core (interfaces + types, zero deps)
  ├── @bodhiapp/bodhi-js (WebUIClient)
  ├── @bodhiapp/bodhi-js-ext (ExtUIClient)
  └── @bodhiapp/bodhi-js-react-core (BodhiProvider DI shell)
        ├── @bodhiapp/bodhi-js-react (preset: auto-creates WebUIClient)
        └── @bodhiapp/bodhi-js-react-ext (preset: auto-creates ExtUIClient)
```

## Generic API Access

For server endpoints not covered by the namespaced API:

```tsx
const { client } = useBodhi();

// Authenticated GET
const result = await client.sendApiRequest(
  'GET',
  '/bodhi/v1/custom-endpoint',
  undefined, // no body for GET
  undefined, // default headers
  true // include auth token
);

// Authenticated POST with body
const result = await client.sendApiRequest('POST', '/bodhi/v1/custom-endpoint', { key: 'value' }, { 'X-Custom-Header': 'value' }, true);

// Generic streaming
const stream = client.stream('POST', '/v1/custom-stream', { prompt: 'Hello' }, undefined, true);

for await (const chunk of stream) {
  // Process custom stream chunks
}
```

### Error Handling for Generic API

```tsx
import { isApiResultSuccess, isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/bodhi/v1/info');

if (isApiResultSuccess(result)) {
  // result.body — typed response
  // result.status — HTTP status code
  // result.headers — response headers
} else if (isApiResultOperationError(result)) {
  // result.error.message — error description
  // result.error.type — error category
}
```

## Key Source Files

- `bodhi-js-sdk/core/src/openai-client-compat.ts` — Toolsets (line 184) and Mcps (line 227) resource classes
- `bodhi-js-sdk/core/src/interface.ts` — UIClient interface with all method signatures
- `bodhi-js-sdk/core/src/access-request.ts` — AccessRequestBuilder and polling logic
- `bodhi-js-sdk/web/src/direct-client.ts` — login() implementation with access request integration
- `bodhi-js-sdk/core/src/types/client-state.ts` — BackendServerState with deployment field
- `bodhi-js-sdk/core/src/types/index.ts` — LoginOptions, LoginProgressStage, LoginProgressCallback
- `bodhi-js-sdk/docs/` — Comprehensive guides for all advanced topics
- `sdk-test-app/web/src/` — Reference app demonstrating tool calling and generic API usage
