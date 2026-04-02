# Advanced Integration Patterns

Advanced usage patterns for the Bodhi JS SDK, building on the [Getting Started](./getting-started.md) guide.

## Login with Access Requests

The `login()` function accepts an options object to request access to specific MCP servers, control the authentication flow, and monitor progress.

### LoginOptions Interface

```typescript
interface LoginOptions {
  userRole?: UserScope; // 'scope_user_user' | 'scope_user_power_user'
  requested?: RequestedResources; // MCPs to request access to
  flowType?: FlowType; // 'redirect' | 'popup'
  redirectUrl?: string; // Custom redirect after login
  onProgress?: LoginProgressCallback;
  pollIntervalMs?: number; // Default: 2000
  pollTimeoutMs?: number; // Default: 300000 (5 minutes)
}

type LoginProgressStage = 'requesting' | 'reviewing' | 'authenticating';
type LoginProgressCallback = (stage: LoginProgressStage) => void;
```

### Requesting MCP Access

When your application needs specific MCP servers, request access during login. The admin reviews and approves the request:

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function LoginWithAccess() {
  const { login, canLogin } = useBodhi();

  const handleLogin = async () => {
    await login({
      requested: {
        mcp_servers: [
          { url: 'http://localhost:3000/mcp' },
        ],
      },
      onProgress: (stage) => {
        // stage: 'requesting' -> 'reviewing' -> 'authenticating'
        console.log('Login stage:', stage);
      },
    });
  };

  return <button onClick={handleLogin} disabled={!canLogin}>Login</button>;
}
```

### Progress Stages

| Stage            | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `requesting`     | Submitting the access request to the server              |
| `reviewing`      | Waiting for admin approval (polls until approved/denied) |
| `authenticating` | Access granted, completing OAuth authentication          |

## MCP Agentic Patterns

Build agentic chat loops where the LLM can discover and call tools via MCP servers.

Use `client.mcps.list()` to discover available MCP servers, then connect to each via `createMcpClient(client, mcp.path)` for tool listing and execution.

### Discover MCP Servers

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';
import { createMcpClient } from '@bodhiapp/bodhi-js-react/mcp';

const { client } = useBodhi();

// Fetch all MCPs for this app
const { mcps } = await client.mcps.list();

for (const mcp of mcps) {
  console.log(`${mcp.slug}: ${mcp.path}`);
  const mcpClient = await createMcpClient(client, mcp.path);
  const { tools } = await mcpClient.listTools();
  // Use tools...
  await mcpClient.close();
}
```

## Extension SDK

For Chrome extension UIs (popups, options pages, side panels), use the extension variant:

```bash
npm install @bodhiapp/bodhi-js-react-ext
```

```typescript
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react-ext';

// Same API surface, different transport (Chrome extension messaging)
function ExtensionPopup() {
  return (
    <BodhiProvider authClientId="your-extension-client-id">
      <PopupContent />
    </BodhiProvider>
  );
}

function PopupContent() {
  const { isOverallReady, isAuthenticated, login, client } = useBodhi();
  // Identical hook API - uses chrome.runtime messaging internally
}
```

The extension SDK uses `chrome.runtime.sendMessage` for communication instead of `window.bodhiext` / direct HTTP. All `client.*` APIs remain the same.

## Custom Client Configuration

### clientConfig Prop

Pass `WebUIClientParams` to customize the auto-created client:

```typescript
<BodhiProvider
  authClientId="your-client-id"
  clientConfig={{
    authServerUrl: 'https://id.getbodhi.app/realms/bodhi',
    redirectUri: 'http://localhost:3000/callback',
    logLevel: 'debug',
    apiTimeoutMs: 30000,
    initParams: {
      extension: {
        timeoutMs: 15000,  // Extension discovery timeout
        intervalMs: 500,   // Polling interval
      },
    },
  }}
>
  <App />
</BodhiProvider>
```

### WebUIClientParams

| Param                             | Type        | Default                                | Description                 |
| --------------------------------- | ----------- | -------------------------------------- | --------------------------- |
| `redirectUri`                     | `string`    | `{origin}{basePath}/callback`          | OAuth redirect URI          |
| `authServerUrl`                   | `string`    | `https://id.getbodhi.app/realms/bodhi` | Auth server URL             |
| `userRole`                        | `UserScope` | `'scope_user_user'`                    | Default user role           |
| `basePath`                        | `string`    | `'/'`                                  | App base path               |
| `logLevel`                        | `LogLevel`  | `'warn'`                               | Logging level               |
| `apiTimeoutMs`                    | `number`    | --                                     | API request timeout         |
| `initParams.extension.timeoutMs`  | `number`    | --                                     | Extension discovery timeout |
| `initParams.extension.intervalMs` | `number`    | --                                     | Extension polling interval  |

### Custom Client Override (DI Pattern)

For full control, create and inject a client instance directly:

```typescript
import { WebUIClient, BodhiProvider } from '@bodhiapp/bodhi-js-react';

const customClient = new WebUIClient('your-client-id', {
  authServerUrl: 'https://id.getbodhi.app/realms/bodhi',
  logLevel: 'debug',
});

function App() {
  return (
    <BodhiProvider client={customClient}>
      <YourApp />
    </BodhiProvider>
  );
}
```

### Using Core Packages Directly

For advanced dependency injection, use `@bodhiapp/bodhi-js-react-core` with `@bodhiapp/bodhi-js`:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('your-client-id');

<BodhiProvider client={client}>
  <App />
</BodhiProvider>
```

This gives you direct control over client creation while using the core React bindings (which depend only on the `UIClient` interface, not on any specific implementation).

## Multi-Tenant

Isolate storage and routing per tenant using `basePath`:

```typescript
<BodhiProvider authClientId="your-client-id" basePath="/tenant-a">
  <TenantApp />
</BodhiProvider>
```

Each `basePath` gets its own isolated storage (connection preferences, auth tokens). The OAuth callback URL is derived as `{origin}{basePath}/callback`.

## Connection Modes

The SDK supports two connection modes: **extension** (via Bodhi Browser extension) and **direct** (HTTP to localhost).

### Checking Current Mode

```typescript
const { clientState, isExtension, isDirect } = useBodhi();

// clientState.mode is 'extension' | 'direct' | null
console.log('Current mode:', clientState.mode);
console.log('Is extension:', isExtension);
console.log('Is direct:', isDirect);
```

### Switching Modes

```typescript
const { client } = useBodhi();

// Switch to direct HTTP mode
await client.setConnectionMode('direct');

// Switch to extension mode
await client.setConnectionMode('extension');
```

### Testing Connectivity

Test connectivity for either mode without switching:

```typescript
const { client } = useBodhi();

// Test extension connectivity
const extState = await client.testExtensionConnectivity();
// Returns ExtensionState: { type: 'extension', extension: 'ready' | 'not-found', ... }

// Test direct connectivity (uses saved URL or provided URL)
const directState = await client.testDirectConnectivity('http://localhost:1135');
// Returns DirectState: { type: 'direct', url: '...', server: { status: '...' } }
```

### Auto-Detection

On first initialization (when `connectionMode` is `null`), the SDK auto-detects the best mode:

1. Tries **direct** first (lower latency)
2. Falls back to **extension** if direct is unavailable

The selected mode is persisted and restored on subsequent page loads.

## sendExtRequest (Escape Hatch)

For direct communication with the Bodhi Browser extension beyond the standard API, use `sendExtRequest`:

```typescript
const { client } = useBodhi();

// Send a custom action to the extension
const response = await client.sendExtRequest('CUSTOM_ACTION', {
  someParam: 'value',
});
```

This is only available when the connection mode is `extension`. It throws an error if the current mode is `direct`. Use this for extension-specific features not exposed through the standard `client.*` API.

## Error Handling

### ApiResponseResult Type

Non-streaming API methods on `IConnectionClient` (like `sendApiRequest`) return `ApiResponseResult<T>`:

```typescript
type ApiResponseResult<T> =
  | { body: T; status: number } // HTTP response (success or error)
  | { error: OperationErrorResponse }; // Operation error (network, extension)
```

Use the provided type guards to handle results:

```typescript
import { isApiResultSuccess, isApiResultError, isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultOperationError(result)) {
  // Network error, extension error, or other operation failure
  console.error('Operation error:', result.error.message, result.error.type);
  return;
}

if (isApiResultError(result)) {
  // HTTP 4xx/5xx with OpenAI-format error body
  console.error('API error:', result.status, result.body);
  return;
}

if (isApiResultSuccess(result)) {
  // HTTP 2xx success
  console.log('Success:', result.body);
}
```

### Namespaced API Error Handling

The namespaced APIs (`client.chat.completions.create()`, `client.models.list()`, `client.embeddings.create()`, `client.mcps.list()`) throw errors instead of returning `ApiResponseResult`:

- **Operation errors**: Thrown as `Error` with the operation error message
- **Non-streaming**: Throws on operation errors; returns the response body directly on success
- **Streaming errors**: Thrown as `Error` with message format `"HTTP {status}: {responseText}"`

```typescript
try {
  const response = await client.chat.completions.create({
    model: 'nonexistent-model',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (err) {
  if (err instanceof Error) {
    console.error('Chat failed:', err.message);
  }
}
```

For streaming:

```typescript
try {
  const stream = client.chat.completions.create({
    model: 'your-model',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true,
  });
  for await (const chunk of stream) {
    // process chunk
  }
} catch (err) {
  // Streaming errors thrown during iteration
  console.error('Stream error:', err);
}
```

### isOperationError

Check if an error object has the operation error structure:

```typescript
import { isOperationError } from '@bodhiapp/bodhi-js-react';

// OperationError: { message: string; type: string }
if (isOperationError(someError)) {
  console.error(someError.message, someError.type);
}
```

### Common Error Types

| Error Type        | Cause                                        |
| ----------------- | -------------------------------------------- |
| `network_error`   | Server unreachable or network failure        |
| `extension_error` | Extension not found or communication failure |
| `auth_error`      | Authentication/authorization failure         |
| `timeout_error`   | Request timeout exceeded                     |
| `operation_error` | General operation failure                    |

## Further Reading

- [Getting Started](./getting-started.md) -- Basic setup and usage
- [Authentication](../authentication.md) -- OAuth flow details, token management, PKCE
- [API Reference](../api-reference.md) -- Complete API documentation
- [Streaming](../streaming.md) -- Streaming architecture details
- [Error Handling](../error-handling.md) -- Error types and patterns in depth
- [Extension SDK](../extension-sdk.md) -- Chrome extension integration guide
