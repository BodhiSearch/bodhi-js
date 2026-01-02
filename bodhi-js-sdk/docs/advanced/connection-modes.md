# Advanced Connection Modes

Detailed state transitions, debugging, and advanced connection mode management patterns.

> For basic connection mode usage, see [Client State](../client-state.md). This guide covers advanced scenarios for power users and debugging.

## Detailed State Transitions

### Extension Mode State Machine

```
INITIAL STATE
├─ not-initialized
│   └─ client created
│       └─ initializing
│           ├─ init() discovers extension
│           │   └─ ready (extension: 'ready')
│           │       └─ server check
│           │           ├─ ready + server: 'ready' ✅
│           │           ├─ ready + server: 'setup'
│           │           ├─ ready + server: 'resource-admin'
│           │           ├─ ready + server: 'error'
│           │           └─ ready + server: 'not-reachable'
│           │
│           └─ init() extension not found
│               └─ extension-not-found
│                   └─ server: 'pending-extension-ready'
```

### Direct Mode State Machine

```
INITIAL STATE
├─ not-initialized
│   └─ client created
│       └─ initializing
│           ├─ init() with serverUrl
│           │   └─ ready (url: configured)
│           │       └─ server check
│           │           ├─ ready + server: 'ready' ✅
│           │           ├─ ready + server: 'setup'
│           │           ├─ ready + server: 'resource-admin'
│           │           ├─ ready + server: 'error'
│           │           └─ ready + server: 'not-reachable'
│           │
│           └─ init() without serverUrl
│               └─ direct-not-connected
│                   └─ server: 'not-connected'
```

### Mode Switching Transitions

```
Extension Mode                 Direct Mode
     ready ────────────────────> ready
           setConnectionMode('direct')

     ready <──────────────────── ready
           setConnectionMode('extension')
```

## Advanced State Checks

### Client Ready Variations

```typescript
import { isClientReady, isExtensionClientReady, isDirectClientReady } from '@bodhiapp/bodhi-js-core';

const state = client.getState();

// Generic client ready (any mode)
if (isClientReady(state)) {
  // Extension ready OR direct URL configured
}

// Extension-specific
if (isExtensionClientReady(state)) {
  // state.type === 'extension' && state.extension === 'ready'
  console.log('Extension ID:', state.extensionId);
}

// Direct-specific
if (isDirectClientReady(state)) {
  // state.type === 'direct' && state.url !== null
  console.log('Server URL:', state.url);
}
```

### Server Ready Variations

```typescript
import { isServerReady, isExtensionServerReady, isDirectServerReady } from '@bodhiapp/bodhi-js-core';

// Server ready (any mode)
if (isServerReady(state.server)) {
  // server.status === 'ready'
}

// Extension + server both ready
if (isExtensionServerReady(state)) {
  // Extension ready AND server ready
}

// Direct + server both ready
if (isDirectServerReady(state)) {
  // Direct ready AND server ready
}
```

## Debugging State

### Enable Debug Logging

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('client-id', {
  logLevel: 'debug', // See all state changes
});

// Logs appear as:
// [WebUIClient] State transition: initializing -> ready
// [WebUIClient] Server state: not-connected -> ready
```

### State Change Callbacks

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('client-id', undefined, change => {
  if (change.type === 'client-state') {
    console.log('Client state changed:');
    console.log('  Status:', change.state.status);
    console.log('  Mode:', change.state.mode);
    console.log('  Server:', change.state.server.status);

    if (change.state.type === 'extension') {
      console.log('  Extension:', change.state.extension);
      console.log('  Extension ID:', change.state.extensionId);
    } else if (change.state.type === 'direct') {
      console.log('  URL:', change.state.url);
    }
  }
});
```

### State Inspection Component

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function StateDebugger() {
  const { client, clientState } = useBodhi();
  const sdkState = client.getState();

  return (
    <details>
      <summary>SDK State Debug</summary>
      <div>
        <h4>React ClientContextState (flattened)</h4>
        <pre>{JSON.stringify(clientState, null, 2)}</pre>

        <h4>SDK ClientState (discriminated union)</h4>
        <pre>{JSON.stringify(sdkState, null, 2)}</pre>

        <h4>State Mapping</h4>
        <table>
          <tr>
            <th>React Property</th>
            <th>SDK Property</th>
          </tr>
          <tr>
            <td>status: {clientState.status}</td>
            <td>
              {sdkState.type === 'extension'
                ? `extension: ${sdkState.extension}`
                : `url: ${sdkState.url ? 'configured' : 'null'}`}
            </td>
          </tr>
          <tr>
            <td>mode: {clientState.mode}</td>
            <td>type: {sdkState.type}</td>
          </tr>
        </table>
      </div>
    </details>
  );
}
```

## React Context State Mapping

The React context transforms SDK's discriminated union into a flat interface for easier component rendering.

### Mapping Logic

```typescript
import { clientStateToContextState } from '@bodhiapp/bodhi-js-react';

// SDK ExtensionState
const sdkState: ExtensionState = {
  type: 'extension',
  extension: 'ready',
  extensionId: 'abc123',
  server: { status: 'ready', version: '0.1.0', error: null },
};

// Transforms to React ClientContextState
const contextState = clientStateToContextState(sdkState);
// {
//   status: 'ready',
//   mode: 'extension',
//   extensionId: 'abc123',
//   url: null,
//   server: { status: 'ready', version: '0.1.0', error: null },
//   error: null
// }
```

### Status Mapping

| SDK State                      | React Status             |
| ------------------------------ | ------------------------ |
| `extension: 'not-initialized'` | `'not-initialized'`      |
| During `init()`                | `'initializing'`         |
| `extension: 'not-found'`       | `'extension-not-found'`  |
| `extension: 'ready'`           | `'ready'`                |
| `url: null`                    | `'direct-not-connected'` |
| `url: configured`              | `'ready'`                |

### Using Helper Functions

```typescript
import { ClientCtxState, isClientCtxNotInitialized, isClientCtxInitializing, isClientCtxInitialized, isClientCtxReady, isOverallReady } from '@bodhiapp/bodhi-js-react';

const { clientState } = useBodhi();

// Namespace-based
if (ClientCtxState.isNotInitialized(clientState)) {
  // status === 'not-initialized'
}

if (ClientCtxState.isInitializing(clientState)) {
  // status === 'initializing'
}

if (ClientCtxState.isInitialized(clientState)) {
  // status !== 'not-initialized' && status !== 'initializing'
}

if (ClientCtxState.isReady(clientState)) {
  // status === 'ready'
}

if (ClientCtxState.isOverallReady(clientState)) {
  // status === 'ready' && server.status === 'ready'
}

// Or individual functions
if (isClientCtxReady(clientState)) {
  console.log('Client ready');
}

if (isOverallReady(clientState)) {
  console.log('Client AND server both ready');
}
```

## Advanced Mode Selection Patterns

### Smart Mode Selection

```typescript
async function selectBestMode(client: WebUIClient) {
  // Test both modes
  const [extState, directState] = await Promise.all([client.testExtensionConnectivity(), client.testDirectConnectivity('http://localhost:1135')]);

  // Check capabilities
  const extReady = extState.extension === 'ready' && extState.server.status === 'ready';
  const directReady = directState.server.status === 'ready';

  if (directReady && !extReady) {
    // Direct works, extension doesn't
    await client.setConnectionMode('direct');
    return 'direct';
  }

  if (extReady && !directReady) {
    // Extension works, direct doesn't
    await client.setConnectionMode('extension');
    return 'extension';
  }

  if (extReady && directReady) {
    // Both work - prefer direct for lower latency
    await client.setConnectionMode('direct');
    return 'direct';
  }

  // Neither works
  throw new Error('No connection mode available');
}
```

### Fallback Strategy

```typescript
async function initWithFallback(client: WebUIClient) {
  try {
    // Try direct first (lower latency)
    await client.setConnectionMode('direct');
    await client.init({ testConnection: true });
  } catch (err) {
    console.warn('Direct mode failed, falling back to extension');

    try {
      await client.setConnectionMode('extension');
      await client.init({ testConnection: true });
    } catch (err2) {
      console.error('Both modes failed');
      throw err2;
    }
  }
}
```

### Mode Health Check

```typescript
async function checkModeHealth(client: WebUIClient) {
  const state = client.getState();

  if (state.type === 'extension') {
    // Verify extension still responsive
    try {
      const health = await client.sendExtRequest('ping');
      return health.ok;
    } catch {
      return false;
    }
  } else if (state.type === 'direct') {
    // Verify server still reachable
    try {
      const result = await client.sendApiRequest('GET', '/bodhi/v1/info');
      return isApiResultSuccess(result);
    } catch {
      return false;
    }
  }

  return false;
}
```

## Performance Optimization

### Lazy Initialization

```typescript
function App() {
  const [client] = useState(() => {
    // Create client lazily on first render
    return new WebUIClient('client-id');
  });

  useEffect(() => {
    // Initialize asynchronously
    client.init().then(state => {
      console.log('Initialized:', state);
    });
  }, [client]);

  return <BodhiProvider client={client}>...</BodhiProvider>;
}
```

### State Persistence for Fast Init

```typescript
const client = useMemo(() => {
  const saved = localStorage.getItem('bodhi-state');
  const savedState = saved ? JSON.parse(saved) : undefined;

  return new WebUIClient('client-id', undefined, change => {
    if (change.type === 'client-state') {
      // Persist on state change
      const serialized = {
        extensionId: change.state.extensionId,
        url: change.state.url,
        connectionMode: client.getConnectionMode(),
      };
      localStorage.setItem('bodhi-state', JSON.stringify(serialized));
    }
  });
}, []);

useEffect(() => {
  // Fast init using saved state
  const saved = localStorage.getItem('bodhi-state');
  client.init({
    savedState: saved ? JSON.parse(saved) : undefined,
  });
}, [client]);
```

## Troubleshooting

### State Not Updating

**Problem**: UI not reflecting state changes

**Solution**:

```typescript
// ✅ DO use useBodhi() in React components
const { clientState } = useBodhi();

// ❌ DON'T call getState() directly (won't trigger re-render)
const state = client.getState(); // Static snapshot
```

### Mode Switch Fails

**Problem**: `setConnectionMode()` throws error

**Debug**:

```typescript
try {
  await client.setConnectionMode('extension');
} catch (err) {
  console.error('Mode switch failed:', err);

  // Check if mode is available
  const extState = await client.testExtensionConnectivity();
  console.log('Extension available:', extState.extension === 'ready');
}
```

### State Inconsistency

**Problem**: React state doesn't match SDK state

**Debug**:

```typescript
function StateConsistencyCheck() {
  const { client, clientState } = useBodhi();
  const sdkState = client.getState();

  const isConsistent = clientState.mode === sdkState.type && clientState.extensionId === (sdkState.type === 'extension' ? sdkState.extensionId : null);

  if (!isConsistent) {
    console.error('State inconsistency detected!');
    console.log('React:', clientState);
    console.log('SDK:', sdkState);
  }

  return isConsistent ? '✅ Consistent' : '❌ Inconsistent';
}
```

---

← Back to [Client State](../client-state.md)
