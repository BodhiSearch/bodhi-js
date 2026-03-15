# React Integration

Deep dive into using Bodhi JS SDK with React applications through `BodhiProvider` and the `useBodhi()` hook.

## Installation

### Recommended: Use Preset Packages

```bash
# For web applications
npm install @bodhiapp/bodhi-js-react

# For Chrome extensions
npm install @bodhiapp/bodhi-js-react-ext
```

These preset packages include everything you need in a single install.

### Advanced: Custom Client Configuration

If you need custom client configuration, use the core package with manual client creation:

```bash
# Web apps with custom config
npm install @bodhiapp/bodhi-js-react-core @bodhiapp/bodhi-js

# Extensions with custom config
npm install @bodhiapp/bodhi-js-react-core @bodhiapp/bodhi-js-ext
```

See [Client Injection](./advanced/client-injection.md) for details.

**Peer Dependencies**:

- React ^18.3.0 || ^19.0.0

## Overview

The React packages provide React-specific bindings that wrap the SDK with React Context, hooks, and automatic state management.

**Key Features**:

- Auto-configured preset packages (`@bodhiapp/bodhi-js-react`, `@bodhiapp/bodhi-js-react-ext`)
- Context-based state management with `BodhiProvider`
- `useBodhi()` hook for easy SDK access from components
- Automatic OAuth callback handling
- Built-in setup modal integration
- Flattened state model optimized for React UX
- TypeScript support with full type inference

## BodhiProvider Component

The `BodhiProvider` is a React Context provider that wraps your application and manages the SDK client lifecycle.

### Quick Setup (Recommended)

**For Web Applications**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

function App() {
  return (
    <BodhiProvider authClientId="your-client-id">
      <YourApp />
    </BodhiProvider>
  );
}
```

**For Chrome Extensions**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-ext';

function ExtensionUI() {
  return (
    <BodhiProvider authClientId="your-extension-id">
      <YourExtensionUI />
    </BodhiProvider>
  );
}
```

**That's it!** The preset packages auto-create and configure the client for you.

### Quick Setup Props

```typescript
interface BodhiProviderProps {
  authClientId: string; // Your OAuth client ID (required)
  children: ReactNode; // Your app components
  clientConfig?: ClientParams; // Optional custom configuration
  modalHtmlPath?: string; // Path to setup modal HTML
  handleCallback?: boolean; // Auto-handle OAuth callback (default: true)
  callbackPath?: string; // OAuth callback path (auto-computed from basePath if not provided)
  basePath?: string; // App base path (default: '/')
  logLevel?: LogLevel; // Logging level (default: 'warn')
}
```

**Prop Details**:

| Prop             | Type            | Default                                | Description                                                                                                              |
| ---------------- | --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `authClientId`   | `string`        | Required                               | Your OAuth client ID                                                                                                     |
| `children`       | `ReactNode`     | Required                               | Your application components                                                                                              |
| `clientConfig`   | `ClientParams?` | undefined                              | Optional custom client configuration                                                                                     |
| `handleCallback` | `boolean?`      | `true`                                 | Automatically handle OAuth redirect callbacks                                                                            |
| `callbackPath`   | `string?`       | Auto-computed (`${basePath}/callback`) | OAuth callback path. Auto-computed from basePath if not provided. When provided, used as-is (include basePath if needed) |
| `basePath`       | `string?`       | `/`                                    | Application base path for routing                                                                                        |
| `logLevel`       | `LogLevel?`     | `warn`                                 | Logging verbosity                                                                                                        |

### Advanced: Custom Client Configuration

If you need custom client configuration, you can pass a `clientConfig` object:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

<BodhiProvider
  authClientId="your-client-id"
  clientConfig={{
    redirectUri: 'https://myapp.com/callback',
    basePath: '/tenant-123',
    logLevel: 'debug',
  }}
>
  <YourApp />
</BodhiProvider>
```

Or use the dependency injection pattern for full control:

```typescript
import { BodhiProvider, WebUIClient } from '@bodhiapp/bodhi-js-react';

const client = new WebUIClient('client-id', {
  redirectUri: 'https://myapp.com/callback',
  basePath: '/tenant-123',
});

<BodhiProvider client={client}>
  <YourApp />
</BodhiProvider>
```

See [Client Injection](./advanced/client-injection.md) for multi-tenant, testing, and other advanced scenarios.

## useBodhi Hook

The `useBodhi()` hook provides access to the SDK client and state from any component within the provider.

### Basic Usage

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function MyComponent() {
  const { client, isOverallReady, isAuthenticated } = useBodhi();

  if (!isOverallReady) {
    return <div>Connecting...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return <div>Ready to use!</div>;
}
```

### Complete Context API

```typescript
interface BodhiContext {
  // Core
  client: UIClient; // SDK client instance
  clientState: ClientContextState; // Flattened client state
  auth: AuthState; // Authentication state

  // Auth functions
  login: (options?: LoginOptions) => Promise<AuthState | void>; // Initiate OAuth login
  logout: () => Promise<void>; // Logout and clear tokens
  isAuthLoading: boolean; // Auth operation in progress

  // Setup modal
  setupState: SetupState; // 'ready' | 'loading' | 'loaded'
  showSetup: () => Promise<void>; // Open setup wizard
  hideSetup: () => void; // Close setup wizard

  // Computed auth properties
  isAuthenticated: boolean; // auth.status === 'authenticated'
  canLogin: boolean; // isReady && !isAuthLoading

  // Computed connection properties
  isReady: boolean; // clientState.status === 'ready'
  isServerReady: boolean; // clientState.server.status === 'ready'
  isOverallReady: boolean; // isReady && isServerReady (both ready)
  isInitializing: boolean; // clientState.status === 'initializing'
  isExtension: boolean; // clientState.mode === 'extension'
  isDirect: boolean; // clientState.mode === 'direct'
}
```

## ClientContextState (React-Specific State)

The provider flattens the SDK's discriminated union `ClientState` into a single `ClientContextState` interface optimized for React components.

### State Structure

```typescript
interface ClientContextState {
  status: ClientContextStatus; // Current connection status
  mode: 'extension' | 'direct' | null; // null when not initialized
  extensionId: string | null; // Extension ID (extension mode only)
  url: string | null; // Server URL (direct mode only)
  server: BackendServerState; // Server state (always present)
  error: OperationErrorResponse | null; // Error details (if any)
}

type ClientContextStatus =
  | 'not-initialized' // Client not yet created
  | 'initializing' // client.init() in progress
  | 'extension-not-found' // Extension mode - extension not detected
  | 'direct-not-connected' // Direct mode - URL not configured
  | 'ready'; // Ready for API calls
```

### Comparing SDK ClientState vs React ClientContextState

**SDK ClientState** (discriminated union):

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

**React ClientContextState** (flat interface):

```typescript
interface ClientContextState {
  status: 'not-initialized' | 'initializing' | 'extension-not-found' | 'direct-not-connected' | 'ready';
  mode: 'extension' | 'direct' | null;
  extensionId: string | null; // Single interface has both
  url: string | null; // fields (nullable)
  server: BackendServerState;
}
```

**Why the difference?**

- SDK: Type-safe discriminated unions prevent accessing wrong fields
- React: Flat structure easier for component rendering logic
- Provider automatically maps SDK state → React state

## Computed Properties

The `useBodhi()` hook provides computed boolean properties for common state checks:

### Connection Properties

```typescript
const {
  isReady, // Client has extension handle or direct URL configured
  isServerReady, // Server status is 'ready' (operational)
  isOverallReady, // Both client AND server ready (most common check)
  isInitializing, // client.init() in progress
  isExtension, // Using extension connection mode
  isDirect, // Using direct HTTP connection mode
} = useBodhi();
```

**Usage Example**:

```typescript
function ConnectionStatus() {
  const { isOverallReady, isInitializing, clientState } = useBodhi();

  if (isInitializing) {
    return <Spinner>Initializing...</Spinner>;
  }

  if (!isOverallReady) {
    return (
      <Alert>
        Status: {clientState.status}<br/>
        Server: {clientState.server.status}
      </Alert>
    );
  }

  return <Badge>Connected</Badge>;
}
```

### Authentication Properties

```typescript
const {
  isAuthenticated, // auth.status === 'authenticated'
  canLogin, // isReady && !isAuthLoading (login button enabled)
  isAuthLoading, // Auth operation in progress
} = useBodhi();
```

**Usage Example**:

```typescript
function LoginButton() {
  const { isAuthenticated, canLogin, isAuthLoading, login } = useBodhi();

  if (isAuthenticated) {
    return <div>Logged in</div>;
  }

  return (
    <button onClick={() => login()} disabled={!canLogin}>
      {isAuthLoading ? 'Logging in...' : 'Login'}
    </button>
  );
}
```

## OAuth Callback Handling

### Automatic Callback Handling (Recommended)

By default, `BodhiProvider` automatically handles OAuth redirects:

```typescript
<BodhiProvider
  authClientId="your-client-id"
  handleCallback={true}      // Default
  basePath="/"               // callbackPath auto-computed as "/callback"
>
  <App />
</BodhiProvider>

// With custom basePath
<BodhiProvider
  authClientId="your-client-id"
  basePath="/myapp"
>
  <App />
</BodhiProvider>
```

**How it works**:

1. User clicks login → Redirects to OAuth server
2. OAuth server redirects back to `http://yourapp.com${basePath}/callback?code=...&state=...`
3. Provider detects callback URL parameters
4. Calls `client.handleOAuthCallback(code, state)` automatically
5. Redirects to `basePath` after success

### Manual Callback Handling

If you need custom redirect logic:

```typescript
<BodhiProvider authClientId="your-client-id" handleCallback={false}>
  <App />
</BodhiProvider>
```

Create a callback component:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function CallbackPage() {
  const navigate = useNavigate();
  const { client, isAuthenticated } = useBodhi();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state && isWebUIClient(client)) {
      client.handleOAuthCallback(code, state)
        .then(() => navigate('/dashboard'))
        .catch(err => navigate('/login?error=' + err.message));
    }
  }, [client, navigate]);

  return <div>Processing login...</div>;
}
```

## Setup Modal Integration

The provider manages the setup wizard modal lifecycle through the `showSetup()` and `hideSetup()` functions.

### Basic Usage

```typescript
function SetupButton() {
  const { isOverallReady, showSetup } = useBodhi();

  if (isOverallReady) {
    return null;  // Hide when already connected
  }

  return (
    <button onClick={showSetup}>
      Open Setup Wizard
    </button>
  );
}
```

### Setup State

```typescript
const { setupState } = useBodhi();

// setupState values:
// - 'ready': Modal not shown
// - 'loading': Modal iframe loading
// - 'loaded': Modal displayed
```

### Custom Modal Path

If you're self-hosting the setup modal:

```typescript
<BodhiProvider
  authClientId="your-client-id"
  modalHtmlPath="/custom/path/to/modal.html"
>
  <App />
</BodhiProvider>
```

## Advanced Topics

### Multi-Tenant Applications

For multi-tenant SaaS applications where different users/tenants need isolated SDK instances, see [Multi-Tenant Patterns](./advanced/multi-tenant.md).

## Common Patterns

### Conditional Rendering Based on State

```typescript
function ChatInterface() {
  const { isOverallReady, isAuthenticated, showSetup, login } = useBodhi();

  // Not connected
  if (!isOverallReady) {
    return (
      <EmptyState
        title="Setup Required"
        action={<button onClick={showSetup}>Configure Connection</button>}
      />
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Login Required"
        action={<button onClick={() => login()}>Login with OAuth</button>}
      />
    );
  }

  // Ready for use
  return <ChatUI />;
}
```

### Loading States

```typescript
function ApiCallComponent() {
  const { client, isOverallReady } = useBodhi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await client.sendApiRequest('GET', '/v1/models');
      if (isApiResultSuccess(result)) {
        setData(result.body);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOverallReady) {
    return <Skeleton />;  // SDK not ready
  }

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Models'}
      </button>
      {data && <ModelList models={data} />}
    </div>
  );
}
```

### Error Display

```typescript
function ConnectionStatus() {
  const { clientState, isReady, isServerReady } = useBodhi();

  if (clientState.error) {
    return (
      <Alert severity="error">
        <strong>Connection Error:</strong>
        <p>{clientState.error.message}</p>
      </Alert>
    );
  }

  if (!isReady) {
    return <Alert severity="warning">Client not ready: {clientState.status}</Alert>;
  }

  if (!isServerReady) {
    return <Alert severity="warning">Server not ready: {clientState.server.status}</Alert>;
  }

  return <Alert severity="success">Connected ({clientState.mode} mode)</Alert>;
}
```

## TypeScript Tips

### Type Inference

The `useBodhi()` hook provides full type inference:

```typescript
const context = useBodhi();
// context: BodhiContext (fully typed)

const { client } = useBodhi();
// client: UIClient (with all methods typed)
```

### Type Guards

Use type guards to narrow client type:

```typescript
import { isWebUIClient } from '@bodhiapp/bodhi-js-react';

const { client } = useBodhi();

if (isWebUIClient(client)) {
  // TypeScript now knows client has handleOAuthCallback
  await client.handleOAuthCallback(code, state);
}
```

### Generic API Calls

```typescript
import { CreateChatCompletionResponse } from '@bodhiapp/ts-client';

const { client } = useBodhi();

const result = await client.sendApiRequest<void, CreateChatCompletionResponse>(
  'POST',
  '/v1/chat/completions',
  { model: 'gemma-3n-e4b-it', messages: [...] }
);
```

## Helper Functions and Utilities

### ClientCtxState Helpers

The React package exports helper functions for checking client context state:

```typescript
import { ClientCtxState, isClientCtxNotInitialized, isClientCtxInitializing, isClientCtxInitialized, isClientCtxReady, isOverallReady } from '@bodhiapp/bodhi-js-react';

const { clientState } = useBodhi();

// Using namespace
ClientCtxState.isNotInitialized(clientState); // status === 'not-initialized'
ClientCtxState.isInitializing(clientState); // status === 'initializing'
ClientCtxState.isInitialized(clientState); // not 'not-initialized' and not 'initializing'
ClientCtxState.isReady(clientState); // status === 'ready'
ClientCtxState.isOverallReady(clientState); // isReady && server.status === 'ready'

// Or use individual functions
if (isClientCtxReady(clientState)) {
  console.log('Client is ready');
}

if (isOverallReady(clientState)) {
  console.log('Client AND server are both ready');
}
```

### State Mapping Utility

```typescript
import { clientStateToContextState } from '@bodhiapp/bodhi-js-react';

// Convert SDK ClientState to React ClientContextState
const contextState = clientStateToContextState(sdkClientState);
```

This utility is used internally by BodhiProvider but is also exported for advanced use cases.

### Initial State Constants

```typescript
import { INITIAL_CLIENT_CONTEXT_STATE, INITIALIZING_CLIENT_CONTEXT_STATE } from '@bodhiapp/bodhi-js-react';

// INITIAL_CLIENT_CONTEXT_STATE:
// { status: 'not-initialized', mode: null, extensionId: null, url: null,
//   server: BACKEND_SERVER_NOT_CONNECTED, error: null }

// INITIALIZING_CLIENT_CONTEXT_STATE:
// { status: 'initializing', mode: null, extensionId: null, url: null,
//   server: BACKEND_SERVER_NOT_CONNECTED, error: null }
```

These are useful for testing or manual state management.

### Re-exported Type Guards and Utilities

The React package re-exports useful type guards and utilities from core:

```typescript
import {
  // API Result type guards
  isApiResultSuccess,
  isApiResultError,
  isApiResultOperationError,

  // Client state type guards
  isDirectState,
  isExtensionState,
  isClientReady,

  // Auth type guards
  isAuthenticated,
  isAuthLoading,
  isAuthError,

  // Client type guards
  isWebUIClient,

  // Error utilities
  isOperationError,
  createApiError,
  createOperationError,
} from '@bodhiapp/bodhi-js-react';

// Example usage with API results
const result = await client.sendApiRequest('GET', '/v1/models');
if (isApiResultSuccess(result)) {
  console.log(result.body);
} else if (isApiResultOperationError(result)) {
  console.error('Network error:', result.error.message);
} else if (isApiResultError(result)) {
  console.error('API error:', result.body.error.message);
}
```

See [API Requests](./api-requests.md) for more details on API result types.

## Next Steps

- **[Authentication](./authentication.md)** - Deep dive into OAuth flows
- **[API Requests](./api-requests.md)** - Making API calls with the client
- **[Streaming](./streaming.md)** - Real-time chat completions
- **[Onboarding](./onboarding.md)** - Setup modal customization

---

← Back to [Quick Start](./quick-start.md) | Continue to [Authentication](./authentication.md) →
