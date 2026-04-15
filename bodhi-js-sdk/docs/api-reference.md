# API Reference

Complete reference documentation for all Bodhi JS SDK packages.

## Table of Contents

- [WebUIClient](#webuiclient)
- [ExtUIClient](#extuiclient)
- [BodhiProvider](#bodhiprovider)
- [useBodhi Hook](#usebodhi-hook)
- [Types](#types)
- [Type Guards](#type-guards)
- [Error Factories](#error-factories)

---

## WebUIClient

Web application client from `@bodhiapp/bodhi-js`.

### Constructor

```typescript
new WebUIClient(
  authClientId: string,
  config?: WebClientConfig,
  onStateChange?: StateChangeCallback
)
```

**Parameters**:

| Parameter       | Type                   | Description                         |
| --------------- | ---------------------- | ----------------------------------- |
| `authClientId`  | `string`               | OAuth client ID                     |
| `config`        | `WebClientConfig?`     | Client configuration (all optional) |
| `onStateChange` | `StateChangeCallback?` | State change callback               |

**WebClientConfig**:

```typescript
interface WebClientConfig {
  redirectUri?: string; // OAuth redirect URI (auto-computed from basePath if omitted)
  authServerUrl?: string; // OAuth server URL (default: 'https://id.getbodhi.app/realms/bodhi')
  userRole?: UserScope; // User scope (default: 'scope_user_user')
  basePath?: string; // App base path (default: '/')
  logLevel?: LogLevel; // Logging level (default: 'warn')
  initParams?: {
    extension?: {
      timeoutMs?: number; // Extension detection timeout
      intervalMs?: number; // Poll interval
    };
  };
}
```

### Methods

#### init()

```typescript
async init(params?: InitParams): Promise<ClientState>
```

Initialize the client and detect connection mode.

**Parameters**:

- `params.savedState?: SerializedClientState` - Restore from saved state
- `params.selectedConnection?: ConnectionMode` - Force specific mode
- `params.testConnection?: boolean` - Test server connectivity
- `params.serverUrl?: string` - Custom server URL
- `params.timeoutMs?: number` - Timeout for init
- `params.intervalMs?: number` - Poll interval

**Returns**: `Promise<ClientState>`

#### sendApiRequest()

```typescript
async sendApiRequest<TReq, TRes>(
  method: string,
  endpoint: string,
  body?: TReq,
  headers?: Record<string, string>,
  authenticated?: boolean
): Promise<ApiResponse<TRes>>
```

Make API request to local LLM server. Throws `BodhiError` on operational failures. Returns `ApiResponse<TRes>` for any HTTP response. Use `unwrapResponse()` to extract the body and throw `BodhiApiError` on 4xx/5xx.

**Returns**: `Promise<ApiResponse<TRes>>`

#### stream()

```typescript
stream<TReq, TRes>(
  method: string,
  endpoint: string,
  body?: TReq,
  headers?: Record<string, string>,
  authenticated?: boolean
): AsyncGenerator<TRes>
```

Stream API response. Throws `BodhiError` or `BodhiApiError` directly from iteration.

**Returns**: `AsyncGenerator<TRes>`

#### streamText()

```typescript
streamText<TReq>(
  method: string,
  endpoint: string,
  body?: TReq,
  headers?: Record<string, string>,
  authenticated?: boolean
): Promise<StreamTextResult>
```

Stream raw text (SSE lines) from an endpoint. Non-2xx responses are returned as data rather than thrown.

```typescript
interface StreamTextResult {
  status: number;
  headers: Record<string, string>;
  body: AsyncGenerator<string>;
}
```

**Returns**: `Promise<StreamTextResult>`

#### serialize()

```typescript
serialize(): SerializedClientState
```

Serialize the current client state for persistence (e.g. `localStorage`). Can be restored via `init({ savedState })`.

**Returns**: `SerializedClientState`

#### debug()

```typescript
debug(): object
```

Return internal state snapshot for diagnostics and troubleshooting.

**Returns**: `object`

#### getExtensionState()

```typescript
getExtensionState(): ExtensionState | null
```

Get the current extension connection state, or `null` if not in extension mode.

**Returns**: `ExtensionState | null`

#### getDirectState()

```typescript
getDirectState(): DirectState | null
```

Get the current direct HTTP connection state, or `null` if not in direct mode.

**Returns**: `DirectState | null`

---

## OpenAI-Compatible Resources

The SDK provides OpenAI SDK-style namespaced API for common operations.

### client.chat.completions

#### create()

```typescript
// Non-streaming
create(
  body: CreateChatCompletionRequest & { stream?: false }
): Promise<CreateChatCompletionResponse>

// Streaming
create(
  body: CreateChatCompletionRequest & { stream: true }
): AsyncGenerator<CreateChatCompletionStreamResponse>
```

Create a chat completion. Returns `Promise` for non-streaming or `AsyncGenerator` for streaming based on `stream` parameter.

**Parameters**:

| Parameter  | Type                              | Description                             |
| ---------- | --------------------------------- | --------------------------------------- |
| `model`    | `string`                          | Model ID                                |
| `messages` | `ChatCompletionRequestMessage[]`  | Conversation messages                   |
| `stream`   | `boolean?`                        | Enable streaming (default: false)       |
| `...`      | See `CreateChatCompletionRequest` | Additional OpenAI-compatible parameters |

**Returns**: `Promise<CreateChatCompletionResponse>` or `AsyncGenerator<CreateChatCompletionStreamResponse>`

**Example**:

```typescript
// Non-streaming
const response = await client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming
for await (const chunk of client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
})) {
  console.log(chunk.choices[0]?.delta?.content);
}
```

### client.models

#### list()

```typescript
async *list(): AsyncGenerator<Model>
```

List available models. Returns AsyncGenerator for `for await...of` iteration.

**Returns**: `AsyncGenerator<Model>`

**Example**:

```typescript
for await (const model of client.models.list()) {
  console.log(model.id);
}
```

#### retrieve()

```typescript
async retrieve(modelId: string): Promise<Model>
```

Retrieve a specific model by ID.

**Endpoint**: `GET /v1/models/{modelId}`

**Parameters**:

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `modelId` | `string` | Model ID    |

**Returns**: `Promise<Model>`

**Example**:

```typescript
const model = await client.models.retrieve('llama-3.2');
console.log(model.id, model.owned_by);
```

### client.embeddings

#### create()

```typescript
async create(body: CreateEmbeddingRequest): Promise<CreateEmbeddingResponse>
```

Create embeddings for input text.

**Parameters**:

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `model`   | `string` | Embedding model ID            |
| `input`   | `string` | Text to create embeddings for |

**Returns**: `Promise<CreateEmbeddingResponse>`

**Example**:

```typescript
const embedding = await client.embeddings.create({
  model: 'text-embedding-model',
  input: 'Hello world',
});
```

### client.mcps

#### list()

```typescript
async list(): Promise<ListMcpsResponse>
```

List available MCP servers.

**Endpoint**: `GET /bodhi/v1/apps/mcps`

**Returns**: `Promise<ListMcpsResponse>`

**Example**:

```typescript
const { mcps } = await client.mcps.list();
for (const mcp of mcps) {
  console.log(mcp.id, mcp.slug, mcp.path);
}
```

For MCP tool discovery and execution, use `createMcpClient(client, mcp.path)` from `@bodhiapp/bodhi-js-react/mcp` to connect via `@modelcontextprotocol/sdk`.

---

#### login()

```typescript
async login(options?: LoginOptions): Promise<AuthState>
```

Initiate OAuth login flow with optional configuration.

**Parameters**:

- `options?.userRole?: UserScope` - User scope for the login
- `options?.requested?: RequestedResources` - Resources to request access to
- `options?.flowType?: FlowType` - Login flow type
- `options?.redirectUrl?: string` - Custom redirect URL
- `options?.onProgress?: LoginProgressCallback` - Progress callback for login stages
- `options?.pollIntervalMs?: number` - Poll interval in milliseconds
- `options?.pollTimeoutMs?: number` - Poll timeout in milliseconds

**Returns**: `Promise<AuthState>`

#### requestAccess()

```typescript
async requestAccess(body: CreateAccessRequest): Promise<ApiResponse<CreateAccessRequestResponse>>
```

Request access to resources on behalf of the app. Throws `BodhiError` on operational failures; throws `BodhiApiError` on HTTP errors.

**Endpoint**: `POST /bodhi/v1/apps/request-access`

**Returns**: `Promise<ApiResponse<CreateAccessRequestResponse>>`

#### getAccessRequestStatus()

```typescript
async getAccessRequestStatus(requestId: string): Promise<ApiResponse<AccessRequestStatusResponse>>
```

Check the status of an access request. Throws `BodhiError` on operational failures; throws `BodhiApiError` on HTTP errors.

**Endpoint**: `GET /bodhi/v1/apps/access-requests/{requestId}?app_client_id=xxx`

**Returns**: `Promise<ApiResponse<AccessRequestStatusResponse>>`

#### pollAccessRequestStatus()

```typescript
async pollAccessRequestStatus(
  requestId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<AccessRequestStatusResponse>
```

Poll an access request until it is approved, denied, failed, or expired.

**Parameters**:

- `requestId: string` - The access request ID
- `options?.intervalMs?: number` - Poll interval in milliseconds
- `options?.timeoutMs?: number` - Poll timeout in milliseconds

**Returns**: `Promise<AccessRequestStatusResponse>`

#### handleAccessRequestCallback() (IWebUIClient only)

```typescript
async handleAccessRequestCallback(requestId: string): Promise<AuthState>
```

Handle the callback when a user returns from the access request review URL redirect. Only available on `IWebUIClient` (web SDK).

**Returns**: `Promise<AuthState>`

#### logout()

```typescript
async logout(): Promise<AuthState>
```

Logout and revoke tokens.

**Returns**: `Promise<AuthState>`

#### getAuthState()

```typescript
async getAuthState(): Promise<AuthState>
```

Get current auth state.

**Returns**: `Promise<AuthState>`

#### handleOAuthCallback()

```typescript
async handleOAuthCallback(code: string, state: string): Promise<AuthState>
```

Handle OAuth redirect callback (web only).

**Returns**: `Promise<AuthState>`

#### setConnectionMode()

```typescript
async setConnectionMode(mode: ConnectionMode): Promise<ClientState>
```

Switch connection mode.

**Parameters**: `mode: 'extension' | 'direct'`

**Returns**: `Promise<ClientState>`

#### getConnectionMode()

```typescript
getConnectionMode(): ConnectionMode | null
```

Get current connection mode.

**Returns**: `'extension' | 'direct' | null`

#### testExtensionConnectivity()

```typescript
async testExtensionConnectivity(timeoutMs?: number): Promise<ExtensionState>
```

Test extension connection.

**Returns**: `Promise<ExtensionState>`

#### testDirectConnectivity()

```typescript
async testDirectConnectivity(serverUrl?: string): Promise<DirectState>
```

Test direct HTTP connection.

**Returns**: `Promise<DirectState>`

#### getState()

```typescript
getState(): ClientState
```

Get current client state.

**Returns**: `ClientState`

---

## ExtUIClient

Extension client from `@bodhiapp/bodhi-js-ext`.

### Constructor

```typescript
new ExtUIClient(
  authClientId: string,
  config?: ExtUIClientConfig,
  onStateChange?: StateChangeCallback
)
```

**ExtUIClientConfig**:

```typescript
interface ExtUIClientConfig {
  authServerUrl?: string; // OAuth server URL (default: 'https://id.getbodhi.app/realms/bodhi')
  userRole?: UserScope; // User scope (default: 'scope_user_user')
  basePath?: string; // App base path (default: '/')
  logLevel?: LogLevel; // Logging level (default: 'warn')
  initParams?: {
    extension?: {
      timeoutMs?: number;
      attempts?: number;
      attemptWaitMs?: number;
      attemptTimeout?: number;
    };
  };
}
```

### Methods

Inherits all methods from WebUIClient except `handleOAuthCallback()`.

#### sendExtRequest()

```typescript
async sendExtRequest(action: string, params?: any): Promise<any>
```

Send extension-specific request.

**Parameters**:

- `action: string` - Action type (e.g., 'get_extension_id')
- `params?: any` - Action parameters

**Returns**: `Promise<any>`

---

## BodhiProvider

React Context provider available in multiple packages with different levels of auto-configuration.

### Preset Packages (Recommended)

#### Web Preset: `@bodhiapp/bodhi-js-react`

Auto-creates `WebUIClient` - just pass `authClientId`.

**Props**:

```typescript
interface BodhiProviderProps {
  authClientId: string; // Required: OAuth client ID
  children: ReactNode; // Required: App components
  clientConfig?: WebUIClientParams; // Optional: Custom client config
  client?: UIClient; // Optional: Override auto-creation
  modalHtmlPath?: string; // Optional: Setup modal HTML path
  handleCallback?: boolean; // Optional: Auto-handle OAuth (default: true)
  callbackPath?: string; // Optional: OAuth callback path (auto-computed from basePath)
  basePath?: string; // Optional: App base path (default: '/')
  logLevel?: LogLevel; // Optional: Logging level (default: 'warn')
}
```

**Usage**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

// Simple usage
<BodhiProvider authClientId="your-client-id">
  <App />
</BodhiProvider>

// With custom config
<BodhiProvider
  authClientId="your-client-id"
  clientConfig={{ redirectUri: 'https://myapp.com/callback', logLevel: 'debug' }}
>
  <App />
</BodhiProvider>
```

#### Extension Preset: `@bodhiapp/bodhi-js-react-ext`

Auto-creates `ExtUIClient` - just pass `authClientId`.

**Props**: Same as web preset, but `clientConfig` is `ExtUIClientParams`.

**Usage**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-ext';

<BodhiProvider authClientId="your-extension-id">
  <ExtensionUI />
</BodhiProvider>
```

### Core Package (Advanced): `@bodhiapp/bodhi-js-react-core`

Uses dependency injection - requires manual client creation.

**Props**:

```typescript
interface BodhiProviderProps {
  children: ReactNode; // Required: App components
  client: UIClient; // Required: Client instance
  modalHtmlPath?: string; // Optional: Setup modal HTML path
  handleCallback?: boolean; // Optional: Auto-handle OAuth (default: true)
  callbackPath?: string; // Optional: OAuth callback path (auto-computed from basePath)
  basePath?: string; // Optional: App base path (default: '/')
  logLevel?: LogLevel; // Optional: Logging level (default: 'warn')
}
```

**Usage**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('client-id', { basePath: '/tenant-123' });

<BodhiProvider client={client}>
  <App />
</BodhiProvider>
```

See [Client Injection](./advanced/client-injection.md) for when to use this pattern.

---

## useBodhi Hook

Access SDK from React components.

### Return Type

```typescript
interface BodhiContext {
  // Core
  client: UIClient;
  clientState: ClientContextState;
  auth: AuthState;

  // Functions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  showSetup: () => Promise<void>;
  hideSetup: () => void;

  // Auth properties
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  canLogin: boolean;

  // Connection properties
  isReady: boolean;
  isServerReady: boolean;
  isOverallReady: boolean;
  isInitializing: boolean;
  isExtension: boolean;
  isDirect: boolean;

  // Setup
  setupState: SetupState;
}
```

### Usage

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function MyComponent() {
  const { client, isOverallReady, isAuthenticated } = useBodhi();
  // ...
}
```

---

## Types

### Importing API Types

Types for OpenAI-compatible API are available via subpath export:

```typescript
import type {
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
  CreateChatCompletionStreamResponse,
  Model,
  CreateEmbeddingRequest,
  CreateEmbeddingResponse,
} from '@bodhiapp/bodhi-js-react/api';

// Or from other packages
import type { Model } from '@bodhiapp/bodhi-js-react-ext/api';
import type { Model } from '@bodhiapp/bodhi-js-core/api';
```

### ClientState

```typescript
type ClientState = ExtensionState | DirectState;

interface ExtensionState {
  type: 'extension';
  extension: 'not-initialized' | 'not-found' | 'ready';
  extensionId: string | null;
  server: BackendServerState;
}

interface DirectState {
  type: 'direct';
  url: string | null;
  server: BackendServerState;
}
```

### ClientContextState

```typescript
interface ClientContextState {
  status: ClientContextStatus;
  mode: 'extension' | 'direct' | null;
  extensionId: string | null;
  url: string | null;
  server: BackendServerState;
  error: OperationErrorResponse | null;
}

type ClientContextStatus = 'not-initialized' | 'initializing' | 'extension-not-found' | 'direct-not-connected' | 'ready';
```

### BackendServerState

```typescript
interface BackendServerState {
  status: ServerStatus;
  version: string | null;
  error: OperationErrorResponse | null;
  deployment?: DeploymentMode | null;
  client_id?: string | null;
}

type DeploymentMode = 'standalone' | 'multi_tenant';

type ServerStatus = 'not-connected' | 'pending-extension-ready' | 'ready' | 'setup' | 'resource_admin' | 'error' | 'not-reachable';
```

### AuthState

```typescript
interface AuthState {
  status: AuthStatus;
  user: UserInfo | null;
  accessToken: string | null;
  error: AuthError | null;
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
```

### UserInfo

```typescript
interface UserInfo {
  sub: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  preferred_username: string;
}
```

### ApiResponse

```typescript
interface ApiResponse<T> {
  body: T;
  status: number;
  headers?: Record<string, string>;
}
```

Returned by `sendApiRequest`. Use `unwrapResponse()` to extract the body and throw `BodhiApiError` on HTTP errors:

```typescript
function unwrapResponse<T>(response: ApiResponse<T>): T; // throws BodhiApiError on status >= 400
```

### BodhiError & BodhiApiError

```typescript
type BodhiErrorCode = 'network' | 'timeout' | 'extension' | 'auth';

class BodhiError extends Error {
  readonly code: BodhiErrorCode;
}

class BodhiApiError extends BodhiError {
  readonly status: number;
  readonly body: OpenAiApiError;
  readonly headers?: Record<string, string>;
}

interface OpenAiApiError {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}
```

Use `instanceof` to discriminate:

```typescript
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

try {
  const body = unwrapResponse(await client.sendApiRequest('GET', '/v1/models'));
} catch (err) {
  if (err instanceof BodhiApiError) {
    /* HTTP error */
  } else if (err instanceof BodhiError) {
    /* operational error */
  }
}
```

### StateChange

```typescript
type StateChange = { type: 'client-state'; state: ClientState } | { type: 'auth-state'; state: AuthState };

type StateChangeCallback = (change: StateChange) => void;
```

### ConnectionMode

```typescript
type ConnectionMode = 'direct' | 'extension';
```

### UserScope

```typescript
type UserScope = 'scope_user_user' | 'scope_user_power_user';
```

### LoginOptions

```typescript
interface LoginOptions {
  userRole?: UserScope;
  requested?: RequestedResources;
  flowType?: FlowType;
  redirectUrl?: string;
  onProgress?: LoginProgressCallback;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

type LoginProgressStage = 'requesting' | 'reviewing' | 'authenticating';
type LoginProgressCallback = (stage: LoginProgressStage) => void;
type FlowType = string;
```

### RequestedResources

```typescript
interface RequestedResources {
  // Resources the app is requesting access to
  [key: string]: unknown;
}
```

### Access Request Types

```typescript
interface CreateAccessRequest {
  // Body for POST /bodhi/v1/apps/request-access
  [key: string]: unknown;
}

interface CreateAccessRequestResponse {
  // Response from creating an access request
  id: string;
  review_url?: string;
  [key: string]: unknown;
}

interface AccessRequestStatusResponse {
  id: string;
  status: AppAccessRequestStatus;
  [key: string]: unknown;
}

type AppAccessRequestStatus = 'draft' | 'approved' | 'denied' | 'failed' | 'expired';
```

### MCP Types

```typescript
interface ListMcpsResponse {
  mcps: Mcp[];
}

interface Mcp {
  id: string;
  slug: string;
  path: string;
  [key: string]: unknown;
}
```

Use `createMcpClient(client, mcp.path)` for MCP tool discovery and execution via `@modelcontextprotocol/sdk`.

### LogLevel

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

---

## Type Guards

From `@bodhiapp/bodhi-js-react`:

### Client State Type Guards

```typescript
function isExtensionState(state: ClientState): state is ExtensionState;

function isDirectState(state: ClientState): state is DirectState;

function isClientReady(state: ClientState): boolean;

function isServerReady(server: BackendServerState): boolean;

function isExtensionClientReady(state: ExtensionState): boolean;

function isExtensionServerReady(state: ExtensionState): boolean;

function isDirectClientReady(state: DirectState): boolean;

function isDirectServerReady(state: DirectState): boolean;
```

### Auth Type Guards

```typescript
function isAuthenticated(auth: AuthState): boolean;

function isAuthLoading(auth: AuthState): boolean;

function isAuthError(auth: AuthState): boolean;
```

### Client Type Guards

```typescript
function isWebUIClient(client: UIClient): client is IWebUIClient;
```

---

## Error Factories

From `@bodhiapp/bodhi-js-core`:

### BodhiApiError constructor

```typescript
new BodhiApiError(
  message: string,
  status: number,
  body: OpenAiApiError,
  headers?: Record<string, string>
): BodhiApiError
```

Create an HTTP error instance for testing or custom middleware.

### BodhiError constructor

```typescript
new BodhiError(message: string, code: BodhiErrorCode): BodhiError
```

Create an operational error instance.

For advanced factory helpers, see [Core Utilities](./advanced/core-utilities.md#error-factories).

---

## Example Usage

### Complete TypeScript Example

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';
import { BodhiProvider, useBodhi, BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from '@bodhiapp/bodhi-js-react/api/openai';

// Create client (minimal - uses defaults)
const client = new WebUIClient('client-id');

// Provider setup
function App() {
  return (
    <BodhiProvider client={client}>
      <ChatApp />
    </BodhiProvider>
  );
}

// Component usage
function ChatApp() {
  const { client, isOverallReady, isAuthenticated, login } = useBodhi();

  if (!isOverallReady) {
    return <div>Not connected</div>;
  }

  if (!isAuthenticated) {
    return <button onClick={login}>Login</button>;
  }

  return <ChatInterface client={client} />;
}

// API call
async function sendMessage(client: UIClient, prompt: string) {
  try {
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
      true  // authenticated
    );
    return unwrapResponse(response).choices[0].message.content;
  } catch (err) {
    if (err instanceof BodhiApiError) {
      throw new Error(`HTTP ${err.status}: ${err.body.error.message}`);
    } else if (err instanceof BodhiError) {
      throw new Error(`Connection error [${err.code}]: ${err.message}`);
    }
    throw err;
  }
}
```

---

## Advanced Topics

For advanced customization and power user scenarios:

- **[Advanced Token Management](./advanced/token-management.md)** - Manual token refresh, PKCE utilities, JWT parsing
- **[Advanced Streaming Patterns](./advanced/streaming-internals.md)** - Custom streaming, debouncing, cancellation, token counting
- **[Advanced Connection Modes](./advanced/connection-modes.md)** - Detailed state transitions, debugging techniques
- **[Core Utilities](./advanced/core-utilities.md)** - Error factories for custom error creation

## SDK Contributor Documentation

For SDK contributors or custom SDK integrations:

- **[SDK Internals](./internals/sdk-internals.md)** - State factories, storage keys, serialization, ext2ext communication protocol, and setup modal iframe message protocol

---

## Additional Resources

- [GitHub Repository](https://github.com/BodhiSearch/bodhi-js)
- [NPM Packages](https://www.npmjs.com/org/bodhiapp)
- [Issue Tracker](https://github.com/BodhiSearch/bodhi-js/issues)
- [Developer Portal](https://developer.getbodhi.app) - Register your app/extension

---

← Back to [Extension SDK](./extension-sdk.md) | Return to [Overview](./index.md)
