# Client State Management

Understanding connection modes, state transitions, and state management in the Bodhi JS SDK.

## Overview

The SDK manages two primary state types:

- **ClientState**: Connection status and server state
- **AuthState**: Authentication status and user info

This guide focuses on ClientState and connection mode management.

## Connection Modes

The SDK supports two connection modes for communicating with the Bodhi App backend:

### Extension Mode (Recommended)

Communicates via the Bodhi Browser extension:

- **Pros**: Works across all domains, no CORS issues, better security
- **Cons**: Requires extension installation
- **Use When**: Building production web apps

```typescript
const { clientState } = useBodhi();

if (clientState.mode === 'extension') {
  console.log('Using extension:', clientState.extensionId);
}
```

### Direct Mode

Direct HTTP connection to localhost:

- **Pros**: Lower latency, no extension needed for development
- **Cons**: Requires Local Network Access permission (Chrome 130+)
- **Use When**: Development or extension unavailable

```typescript
const { clientState } = useBodhi();

if (clientState.mode === 'direct') {
  console.log('Using direct connection:', clientState.url);
}
```

## ClientState Structure

### SDK ClientState (Discriminated Union)

The underlying SDK uses a type-safe discriminated union:

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

### React ClientContextState (Flat Interface)

React components receive a flattened state:

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

type DeploymentMode = 'standalone' | 'multi_tenant';

interface BackendServerState {
  status: ServerStatus;
  version: string | null;
  deployment?: DeploymentMode | null;
  client_id?: string | null;
  error: OperationErrorResponse | null;
}

type ServerStatus =
  | 'not-connected'
  | 'pending-extension-ready'
  | 'ready'
  | 'tenant_selection'
  | 'setup'
  | 'resource_admin'
  | 'error'
  | 'not-reachable';
```

## Client Status Values

### not-initialized

Initial state before client creation:

```typescript
{
  status: 'not-initialized',
  mode: null,
  extensionId: null,
  url: null,
  server: { status: 'not-connected', version: null, deployment: null, client_id: null, error: null }
}
```

### initializing

Client.init() in progress:

```typescript
{
  status: 'initializing',
  mode: null,
  extensionId: null,
  url: null,
  server: { status: 'not-connected', version: null, deployment: null, client_id: null, error: null }
}
```

### extension-not-found

Extension mode but extension not detected:

```typescript
{
  status: 'extension-not-found',
  mode: 'extension',
  extensionId: null,
  url: null,
  server: { status: 'pending-extension-ready', version: null, deployment: null, client_id: null, error: null }
}
```

### direct-not-connected

Direct mode but no server URL configured:

```typescript
{
  status: 'direct-not-connected',
  mode: 'direct',
  extensionId: null,
  url: null,
  server: { status: 'not-connected', version: null, deployment: null, client_id: null, error: null }
}
```

### ready

Client ready for API calls:

```typescript
{
  status: 'ready',
  mode: 'extension',  // or 'direct'
  extensionId: 'abc123',  // or null if direct mode
  url: null,  // or 'http://localhost:1135' if direct
  server: { status: 'ready', version: '0.1.0', deployment: 'standalone', client_id: null, error: null }
}
```

## Server Status Values

### not-connected

Initial state, no connection attempted:

```typescript
{
  status: 'not-connected',
  version: null,
  deployment: null,
  client_id: null,
  error: null
}
```

### pending-extension-ready

Waiting for extension to initialize:

```typescript
{
  status: 'pending-extension-ready',
  version: null,
  deployment: null,
  client_id: null,
  error: null
}
```

### ready

Server operational and ready:

```typescript
{
  status: 'ready',
  version: '0.1.0',
  deployment: 'standalone',  // or 'multi_tenant'
  client_id: null,           // or active tenant's OAuth client_id
  error: null
}
```

### tenant_selection

Server is running in multi-tenant mode and requires tenant selection before proceeding:

```typescript
{
  status: 'tenant_selection',
  version: '0.1.0',
  deployment: 'multi_tenant',
  client_id: null,
  error: {
    message: 'server requires tenant selection',
    type: 'extension_error'
  }
}
```

### setup

Server needs initial configuration:

```typescript
{
  status: 'setup',
  version: '0.1.0',
  deployment: 'standalone',
  client_id: null,
  error: {
    message: 'server is not in ready state, configure to complete setup',
    type: 'extension_error'
  }
}
```

### resource_admin

Server needs resource setup:

```typescript
{
  status: 'resource_admin',
  version: '0.1.0',
  deployment: 'standalone',
  client_id: null,
  error: {
    message: 'server is not in ready state, configure to complete setup',
    type: 'extension_error'
  }
}
```

### error

Server returned an error:

```typescript
{
  status: 'error',
  version: '0.1.0',  // or 'unknown' if version couldn't be determined
  deployment: null,
  client_id: null,
  error: {
    message: 'Server error occurred',
    type: 'server_error'
  }
}
```

### not-reachable

Server not accessible (network error):

```typescript
{
  status: 'not-reachable',
  version: null,
  deployment: null,
  client_id: null,
  error: {
    message: 'Connection refused',
    type: 'network_error'
  }
}
```

## State Transitions

### Extension Mode Flow

```
not-initialized
    ↓ (client created)
initializing
    ↓ (init() called)
extension-not-found (if extension not detected)
    OR
ready (if extension detected)
    ↓ (server check)
ready + server: ready
    OR
ready + server: tenant_selection (multi-tenant, needs tenant selection)
    OR
ready + server: setup (needs configuration)
```

### Direct Mode Flow

```
not-initialized
    ↓ (client created)
initializing
    ↓ (init() called)
direct-not-connected (if no URL)
    OR
ready (if URL configured)
    ↓ (server check)
ready + server: ready
    OR
ready + server: tenant_selection (multi-tenant, needs tenant selection)
    OR
ready + server: setup (needs configuration)
```

## Checking State

### Using Computed Properties

```typescript
const {
  isReady, // Client has handle/URL
  isServerReady, // Server status === 'ready'
  isOverallReady, // Both client AND server ready
  isInitializing, // init() in progress
  isExtension, // mode === 'extension'
  isDirect, // mode === 'direct'
} = useBodhi();
```

### Manual State Checks

```typescript
const { clientState } = useBodhi();

// Check client ready
const clientReady = clientState.status === 'ready';

// Check server ready
const serverReady = clientState.server.status === 'ready';

// Check overall ready
const overallReady = clientReady && serverReady;

// Check mode
const isExtensionMode = clientState.mode === 'extension';
```

### Using Type Guards

```typescript
import { isClientReady, isServerReady, isExtensionState, isDirectState } from '@bodhiapp/bodhi-js-core';

const { client } = useBodhi();
const sdkState = client.getState();

if (isExtensionState(sdkState)) {
  console.log('Extension state:', sdkState.extension);
  console.log('Extension ID:', sdkState.extensionId);
}

if (isDirectState(sdkState)) {
  console.log('Direct URL:', sdkState.url);
}

if (isClientReady(sdkState) && isServerReady(sdkState.server)) {
  console.log('Ready for API calls');
}
```

## Managing Connection Mode

### Auto-Detection

By default, the SDK auto-detects the best connection mode:

```typescript
const client = new WebUIClient('client-id');

// Tries direct first (lower latency)
// Falls back to extension if direct unavailable
await client.init();

const state = client.getState();
console.log('Selected mode:', state.type); // 'direct' or 'extension'
```

### Manual Mode Selection

```typescript
const { client } = useBodhi();

// Switch to extension mode
await client.setConnectionMode('extension');

// Switch to direct mode
await client.setConnectionMode('direct');
```

### Testing Connectivity

Test before switching:

```typescript
// Test extension
const extState = await client.testExtensionConnectivity();
if (extState.extension === 'ready' && extState.server.status === 'ready') {
  await client.setConnectionMode('extension');
}

// Test direct
const directState = await client.testDirectConnectivity('http://localhost:1135');
if (directState.server.status === 'ready') {
  await client.setConnectionMode('direct');
}
```

## State Persistence

The SDK automatically persists connection preferences:

```typescript
// User selects extension mode
await client.setConnectionMode('extension');

// Preference stored in localStorage:
// - bodhi-js-sdk:web:CONNECTION_MODE = 'extension'
// - bodhi-js-sdk:web:EXTENSION_ID = 'abc123'

// Next session automatically uses extension mode
const client2 = new WebUIClient('client-id');
await client2.init();
console.log(client2.getState().type); // 'extension'
```

### Multi-Tenant Storage Isolation

For multi-tenant apps, use `basePath` to automatically namespace storage:

```typescript
const client = new WebUIClient('client-id', {
  basePath: '/tenant1',
});

// basePath automatically namespaces storage keys:
// - /tenant1:bodhi-js-sdk:web:CONNECTION_MODE
// - /tenant1:bodhi-js-sdk:web:EXTENSION_ID
```

## React Patterns

### Conditional Rendering Based on Mode

```typescript
function ModeIndicator() {
  const { isExtension, isDirect, clientState } = useBodhi();

  if (isExtension) {
    return (
      <Badge color="blue">
        Extension Mode (ID: {clientState.extensionId})
      </Badge>
    );
  }

  if (isDirect) {
    return (
      <Badge color="green">
        Direct Mode ({clientState.url})
      </Badge>
    );
  }

  return <Badge color="gray">Not Connected</Badge>;
}
```

### Mode Switcher

```typescript
function ModeSwitcher() {
  const { client, clientState } = useBodhi();
  const [switching, setSwitching] = useState(false);

  const switchMode = async (mode: 'extension' | 'direct') => {
    setSwitching(true);
    try {
      await client.setConnectionMode(mode);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div>
      <label>
        <input
          type="radio"
          checked={clientState.mode === 'extension'}
          onChange={() => switchMode('extension')}
          disabled={switching}
        />
        Extension Mode
      </label>
      <label>
        <input
          type="radio"
          checked={clientState.mode === 'direct'}
          onChange={() => switchMode('direct')}
          disabled={switching}
        />
        Direct Mode
      </label>
    </div>
  );
}
```

### Connection Status Display

```typescript
function ConnectionStatus() {
  const { clientState, isReady, isServerReady, isOverallReady } = useBodhi();

  return (
    <Card>
      <h3>Connection Status</h3>
      <div>
        <StatusBadge active={isReady}>
          Client: {clientState.status}
        </StatusBadge>
        <StatusBadge active={isServerReady}>
          Server: {clientState.server.status}
        </StatusBadge>
        <StatusBadge active={isOverallReady}>
          Overall: {isOverallReady ? 'Ready' : 'Not Ready'}
        </StatusBadge>
      </div>
      {clientState.mode && (
        <div>Mode: {clientState.mode}</div>
      )}
      {clientState.error && (
        <Alert severity="error">{clientState.error.message}</Alert>
      )}
    </Card>
  );
}
```

## Advanced Topics

For detailed state transitions, debugging techniques, and advanced patterns, see [Advanced Connection Modes](./advanced/connection-modes.md).

## Best Practices

### 1. Check Overall Ready

```typescript
// ❌ DON'T check only client ready
if (clientState.status === 'ready') {
  // Server might not be ready!
}

// ✅ DO check both client and server
if (isOverallReady) {
  // Safe to make API calls
}
```

### 2. Handle All States

```typescript
// ✅ Handle all possible states
function StatusMessage() {
  const { clientState } = useBodhi();

  switch (clientState.status) {
    case 'not-initialized':
      return <div>Initializing...</div>;
    case 'initializing':
      return <Spinner />;
    case 'extension-not-found':
      return <Alert>Extension not installed</Alert>;
    case 'direct-not-connected':
      return <Alert>Server URL not configured</Alert>;
    case 'ready':
      return <Badge>Connected</Badge>;
  }
}
```

### 3. Provide Mode Selection

```typescript
// ✅ Let users choose their preferred mode
function Setup() {
  return (
    <div>
      <h2>Choose Connection Mode</h2>
      <ModeOption
        mode="extension"
        title="Extension (Recommended)"
        pros={['Better security', 'Works everywhere']}
        cons={['Requires extension']}
      />
      <ModeOption
        mode="direct"
        title="Direct"
        pros={['Lower latency', 'No extension needed']}
        cons={['Requires LNA permission']}
      />
    </div>
  );
}
```

## React ClientContextState Mapping

When using `@bodhiapp/bodhi-js-react`, the SDK's `ClientState` is automatically transformed to a flattened `ClientContextState` for React components.

### Context State Mapping

The React context uses `clientStateToContextState()` to convert SDK state:

```typescript
// SDK ExtensionState → React ClientContextState
{
  type: 'extension',
  extension: 'ready',
  extensionId: 'abc123',
  server: { status: 'ready', version: '0.1.0', error: null }
}
// transforms to:
{
  status: 'ready',
  mode: 'extension',
  extensionId: 'abc123',
  url: null,
  server: { status: 'ready', version: '0.1.0', error: null },
  error: null
}
```

### Helper Functions

Helper functions from `@bodhiapp/bodhi-js-react`:

```typescript
import { isClientCtxNotInitialized, isClientCtxInitializing, isClientCtxInitialized, isClientCtxReady, isOverallReady } from '@bodhiapp/bodhi-js-react';

const { clientState } = useBodhi();

if (isClientCtxReady(clientState)) {
  console.log('Client ready'); // status === 'ready'
}

if (isOverallReady(clientState)) {
  console.log('Client AND server ready'); // client ready + server.status === 'ready'
}
```

See [React Integration](./react-integration.md) for complete React documentation.

## Next Steps

- **[Error Handling](./error-handling.md)** - Handle state-related errors
- **[Extension SDK](./extension-sdk.md)** - Extension-specific patterns
- **[API Reference](./api-reference.md)** - Complete API documentation

---

← Back to [Onboarding](./onboarding.md) | Continue to [Error Handling](./error-handling.md) →
