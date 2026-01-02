# SDK Internals (For Contributors)

**For SDK contributors and advanced integrations**. This document covers internal protocols, state management, and serialization mechanisms used by the Bodhi JS SDK.

> Most applications don't need direct access to these internals - use the public client APIs (`@bodhiapp/bodhi-js-react`, `@bodhiapp/bodhi-js-react-ext`) instead.

---

## Table of Contents

- [Setup Modal Message Protocol](#setup-modal-message-protocol)
- [Extension-to-Extension Message Protocol](#extension-to-extension-message-protocol)
- [State Management & Serialization](#state-management--serialization)

---

# Setup Modal Message Protocol

The setup modal communicates with the parent application via `postMessage` using a request-response pattern with async handlers.

## Message Types

```typescript
import { MSG } from '@bodhiapp/setup-modal/types';

// Modal lifecycle
MSG.MODAL_READY = 'modal-ready'; // Modal loaded and ready
MSG.MODAL_CLOSE = 'modal-close'; // User closed modal
MSG.MODAL_COMPLETE = 'modal-complete'; // Setup completed

// State management
MSG.MODAL_REFRESH = 'modal-refresh'; // Request state refresh

// User actions
MSG.MODAL_LNA_CONNECT = 'modal-lna-connect'; // Test direct connection
MSG.MODAL_SELECT_CONNECTION = 'modal-select-connection'; // User selected mode
```

## Message Handler Pattern

The modal uses async request handlers:

```typescript
import type { AsyncRequestHandlers } from '@bodhiapp/bodhi-js-core';
import type * as ModalTypes from '@bodhiapp/setup-modal/types';
import { MSG } from '@bodhiapp/setup-modal/types';

const handlers: AsyncRequestHandlers = {
  [MSG.MODAL_READY]: async () => {
    const setupState: ModalTypes.SetupState = {
      platform: { browser: detectBrowser(), os: detectOS() },
      extension: {
        /* extension detection state */
      },
      server: {
        /* server connectivity state */
      },
      lna: {
        /* LNA permission state */
      },
      connection: {
        /* selected connection mode */
      },
    };
    return { setupState };
  },

  [MSG.MODAL_REFRESH]: async () => {
    const extState = await client.testExtensionConnectivity();
    const directState = await client.testDirectConnectivity();
    const setupState: ModalTypes.SetupState = {
      /* ... refreshed state ... */
    };
    return { setupState };
  },

  [MSG.MODAL_LNA_CONNECT]: async msg => {
    const result = await client.testDirectConnectivity(msg.payload.serverUrl);
    return { success: result.server.status === 'ready' };
  },

  [MSG.MODAL_SELECT_CONNECTION]: async msg => {
    await client.setConnectionMode(msg.payload.mode);
    return { success: true };
  },

  [MSG.MODAL_COMPLETE]: () => {
    console.log('Setup completed successfully');
    return undefined;
  },

  [MSG.MODAL_CLOSE]: () => {
    console.log('Setup cancelled by user');
    return undefined;
  },
};
```

## SetupState Structure

```typescript
interface SetupState {
  platform: { browser: BrowserInfo; os: OSInfo };
  extension: {
    status: 'not-started' | 'checking' | 'installed' | 'not-installed';
    extensionId?: string;
  };
  server: {
    status: 'not-started' | 'checking' | 'confirmed' | 'not-confirmed';
    version?: string;
  };
  lna: {
    status: 'not-started' | 'prompt' | 'granted' | 'denied' | 'skipped' | 'unsupported';
  };
  connection: {
    mode: 'extension' | 'direct' | null;
    selected: boolean;
  };
}
```

## OnboardingModal Implementation

```typescript
import { OnboardingModal } from '@bodhiapp/bodhi-js-core';

const modal = new OnboardingModal({
  modalHtmlPath: 'setup-modal.html', // Optional, has default
  handlers, // AsyncRequestHandlers defined above
});

modal.show(initialState);
modal.updateState(updatedState);
modal.destroy();
```

## BodhiProvider Integration

`BodhiProvider` wraps the modal protocol automatically:

```typescript
<BodhiProvider authClientId="my-app">
  <App />
</BodhiProvider>

// Components use simplified API
function MyComponent() {
  const { showSetup, hideSetup } = useBodhi();
  return <button onClick={showSetup}>Setup</button>;
}
```

---

# Extension-to-Extension Message Protocol

The SDK uses a comprehensive message protocol for ext2ext communication between client extensions and the bodhi-browser-ext host extension.

## Message Types

### Request/Response Messages

```typescript
import { EXT2EXT_CLIENT_MESSAGE_TYPES } from '@bodhiapp/bodhi-js-ext';

EXT2EXT_CLIENT_REQUEST = 'EXT2EXT_CLIENT_REQUEST';
EXT2EXT_CLIENT_RESPONSE = 'EXT2EXT_CLIENT_RESPONSE';
EXT2EXT_CLIENT_API_REQUEST = 'EXT2EXT_CLIENT_API_REQUEST';
EXT2EXT_CLIENT_API_RESPONSE = 'EXT2EXT_CLIENT_API_RESPONSE';
EXT2EXT_CLIENT_BROADCAST = 'EXT2EXT_CLIENT_BROADCAST'; // State updates
```

### Streaming Messages

```typescript
EXT2EXT_CLIENT_STREAM_REQUEST = 'EXT2EXT_CLIENT_STREAM_REQUEST';
EXT2EXT_CLIENT_STREAM_CHUNK = 'EXT2EXT_CLIENT_STREAM_CHUNK';
EXT2EXT_CLIENT_STREAM_ERROR = 'EXT2EXT_CLIENT_STREAM_ERROR';
EXT2EXT_CLIENT_STREAM_API_ERROR = 'EXT2EXT_CLIENT_STREAM_API_ERROR';
EXT2EXT_CLIENT_STREAM_DONE = 'EXT2EXT_CLIENT_STREAM_DONE';
```

### Port Names

```typescript
EXT2EXT_CLIENT_STREAM_PORT = 'ext2ext-client-stream';
```

## Actions

Valid actions for `sendExtRequest()`:

```typescript
import { EXT2EXT_CLIENT_ACTIONS } from '@bodhiapp/bodhi-js-ext';

// Authentication
LOGIN = 'LOGIN';
LOGOUT = 'LOGOUT';
GET_AUTH_STATE = 'GET_AUTH_STATE';

// Extension discovery
DISCOVER_EXTENSION = 'DISCOVER_EXTENSION';
GET_EXTENSION_ID = 'GET_EXTENSION_ID';
SET_EXTENSION_ID = 'SET_EXTENSION_ID';
```

## Discovery Protocol

```typescript
const DISCOVERY_TIMEOUT_MS = 5000;
const DISCOVERY_ATTEMPTS = 3;
const DISCOVERY_ATTEMPT_WAIT_MS = 500;
const DISCOVERY_ATTEMPT_TIMEOUT = 500;

// Override via initParams:
const client = new ExtUIClient('client-id', {
  initParams: {
    extension: {
      timeoutMs: 10000,
      attempts: 5,
      attemptWaitMs: 1000,
      attemptTimeout: 1000,
    },
  },
});
```

## Broadcast Listener

ExtClient automatically listens for broadcast messages for cross-component state synchronization.

### How It Works

1. Background script updates state (e.g., after login)
2. Background script broadcasts state change via `EXT2EXT_CLIENT_BROADCAST`
3. All connected UI components (popup, options) receive update
4. Components update their local state automatically

**No manual polling needed** - all extension components stay synchronized via broadcasts.

## Error Handling

### Operation Errors

```typescript
{
  error: {
    message: string;
    type: 'extension_error' | 'network_error' | 'timeout_error';
  }
}
```

### API Errors

```typescript
{ error: { message: string; status: number; body: { error: { message: string; type: string; code?: string } } } }
```

---

# State Management & Serialization

## State Factory Functions

### Extension State Factories

```typescript
import { createExtensionStateNotInitialized, createExtensionStateNotFound, EXTENSION_STATE_NOT_INITIALIZED, EXTENSION_STATE_NOT_FOUND } from '@bodhiapp/bodhi-js-core';

// Not initialized state
const initialState = createExtensionStateNotInitialized();
// { type: 'extension', extension: 'not-initialized', extensionId: null, server: BACKEND_SERVER_NOT_CONNECTED }

// Or use constant
const state = EXTENSION_STATE_NOT_INITIALIZED;

// Not found state
const notFound = createExtensionStateNotFound();
// { type: 'extension', extension: 'not-found', extensionId: null, server: PENDING_EXTENSION_READY }
```

### Direct State Factories

```typescript
import { createDirectStateReady, createDirectStateNotReady, createDirectStateNotReachable, DIRECT_STATE_NOT_INITIALIZED } from '@bodhiapp/bodhi-js-core';

// Not initialized
const initialState = DIRECT_STATE_NOT_INITIALIZED;
// { type: 'direct', url: null, server: BACKEND_SERVER_NOT_CONNECTED }

// Ready state
const readyState = createDirectStateReady('http://localhost:1135', {
  status: 'ready',
  version: '0.1.0',
  error: null,
});

// Not reachable
const errorState = createDirectStateNotReachable({
  message: 'Connection refused',
  type: 'network_error',
});
```

### Backend Server State Factories

```typescript
import { backendServerNotReady, BACKEND_SERVER_NOT_CONNECTED, BACKEND_SERVER_NOT_REACHABLE, PENDING_EXTENSION_READY } from '@bodhiapp/bodhi-js-core';

const notConnected = BACKEND_SERVER_NOT_CONNECTED;
// { status: 'not-connected', version: null, error: null }

const notReachable = BACKEND_SERVER_NOT_REACHABLE;
// { status: 'not-reachable', version: null, error: { ... } }

const pending = PENDING_EXTENSION_READY;
// { status: 'pending-extension-ready', version: null, error: null }

const setupState = backendServerNotReady('setup', '0.1.0', {
  message: 'server is not in ready state, configure to complete setup',
  type: 'extension_error',
});
// { status: 'setup', version: '0.1.0', error: {...} }
```

## Storage Keys

### Storage Prefix Constants

```typescript
import { STORAGE_PREFIXES } from '@bodhiapp/bodhi-js-core';

STORAGE_PREFIXES.WEB = 'bodhi-js-sdk:web'; // Web facade localStorage
STORAGE_PREFIXES.EXT = 'bodhi-js-sdk:ext'; // Extension facade chrome.storage
STORAGE_PREFIXES.WEB_DIRECT = 'bodhi-js-sdk:web:direct'; // Web direct OAuth tokens
STORAGE_PREFIXES.WEB_EXT = 'bodhi-js-sdk:web:ext'; // Web extension OAuth tokens
STORAGE_PREFIXES.EXT_DIRECT = 'bodhi-js-sdk:ext:direct'; // Extension direct OAuth tokens
STORAGE_PREFIXES.EXT_EXT = 'bodhi-js-sdk:ext:ext'; // Extension ext2ext OAuth tokens
```

### Key Generation

```typescript
import { createStorageKeys } from '@bodhiapp/bodhi-js-core';

const keys = createStorageKeys('custom-prefix:');

keys.CONNECTION_MODE; // 'custom-prefix:CONNECTION_MODE'
keys.EXTENSION_ID; // 'custom-prefix:EXTENSION_ID'
keys.ACCESS_TOKEN; // 'custom-prefix:ACCESS_TOKEN'
keys.REFRESH_TOKEN; // 'custom-prefix:REFRESH_TOKEN'
keys.EXPIRES_AT; // 'custom-prefix:EXPIRES_AT'
keys.CLIENT_STATE; // 'custom-prefix:CLIENT_STATE'
keys.DIRECT_STATUS; // 'custom-prefix:DIRECT_STATUS'
keys.SERVER_INSTALL_CONFIRMED; // 'custom-prefix:SERVER_INSTALL_CONFIRMED'
```

### Base Path Integration

```typescript
import { createStoragePrefixWithBasePath } from '@bodhiapp/bodhi-js-core';

const prefix = createStoragePrefixWithBasePath('bodhi:web:', '/app/tenant1');
// Returns: 'bodhi:web:/app/tenant1:'

const keys = createStorageKeys(prefix);
// keys.CONNECTION_MODE = 'bodhi:web:/app/tenant1:CONNECTION_MODE'
```

## State Serialization

### Client State Serialization

```typescript
interface SerializedClientState {
  extensionId?: string; // Extension mode
  url?: string; // Direct mode
  connectionMode?: 'extension' | 'direct'; // Shared
}

// Serialize
const serialized: SerializedClientState = {
  extensionId: client.getState().extensionId,
  connectionMode: client.getConnectionMode(),
};
localStorage.setItem(keys.CLIENT_STATE, JSON.stringify(serialized));

// Deserialize
const saved = JSON.parse(localStorage.getItem(keys.CLIENT_STATE) || '{}');
await client.init({ savedState: saved });
```

### Extension-Specific Serialization

```typescript
interface SerializedExt2ExtState {
  extensionId?: string;
}

const client = new ExtUIClient('client-id');
const serialized = client.serialize();
// Returns: { extensionId: '...' }

// Save for faster next init
localStorage.setItem('ext-state', JSON.stringify(serialized));

// Restore on next session
const saved = JSON.parse(localStorage.getItem('ext-state') || '{}');
const restoredClient = new ExtUIClient('client-id', {
  initParams: { extension: { extensionId: saved.extensionId } },
});
await restoredClient.init(); // Skips discovery if extension ID unchanged
```

**Benefits**: Faster initialization, reduced network calls, better offline handling.

## Helper Functions

### State Extraction

```typescript
import { getExtensionId, getServerUrl, getBackendServerState } from '@bodhiapp/bodhi-js-core';

const state: ClientState = client.getState();

const extensionId = getExtensionId(state); // null if not extension mode
const serverUrl = getServerUrl(state); // null if not direct mode
const serverState = getBackendServerState(state); // always present
```

### Fine-Grained State Checks

```typescript
import { isExtensionClientReady, isDirectClientReady, isExtensionServerReady, isDirectServerReady } from '@bodhiapp/bodhi-js-core';

const state: ClientState = client.getState();

if (isExtensionClientReady(state)) {
  // state.type === 'extension' && state.extension === 'ready'
}

if (isDirectClientReady(state)) {
  // state.type === 'direct' && state.url !== null
}

if (isExtensionServerReady(state)) {
  // isExtensionClientReady(state) && state.server.status === 'ready'
}

if (isDirectServerReady(state)) {
  // isDirectClientReady(state) && state.server.status === 'ready'
}
```

## State Change Callbacks

```typescript
type StateChangeCallback = (change: StateChange) => void;
type StateChange = ClientStateChange | AuthStateChange;

interface ClientStateChange {
  type: 'client-state';
  state: ClientState;
}
interface AuthStateChange {
  type: 'auth-state';
  state: AuthState;
}

// Usage
const client = new WebUIClient('client-id', undefined, change => {
  if (change.type === 'client-state') {
    console.log('Client state changed:', change.state);
  } else if (change.type === 'auth-state') {
    console.log('Auth state changed:', change.state);
  }
});

// No-op callback
import { NOOP_STATE_CALLBACK } from '@bodhiapp/bodhi-js-core';
const client2 = new WebUIClient('id', undefined, NOOP_STATE_CALLBACK);
```

## InitParams Structure

```typescript
interface InitParams {
  savedState?: SerializedClientState; // Restore from saved
  selectedConnection?: ConnectionMode; // Force specific mode
  testConnection?: boolean; // Test server connectivity
  serverUrl?: string; // Custom server URL
  timeoutMs?: number; // Timeout for init
  intervalMs?: number; // Poll interval

  extension?: {
    timeoutMs?: number;
    intervalMs?: number;
    attempts?: number; // ExtUIClient only
    attemptWaitMs?: number; // ExtUIClient only
    attemptTimeout?: number; // ExtUIClient only
  };
}
```

---

## Best Practices

### 1. Use High-Level Clients

```typescript
// ✅ DO use preset packages
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react';

// ❌ DON'T implement protocols manually
chrome.runtime.sendMessage(extensionId, { type: '...' });
```

### 2. Use Constants for Initial States

```typescript
// ✅ DO use constants
import { INITIAL_AUTH_STATE, EXTENSION_STATE_NOT_INITIALIZED } from '@bodhiapp/bodhi-js-core';

// ❌ DON'T create manually
let authState = { status: 'idle', user: null, accessToken: null, error: null };
```

### 3. Serialize State for Performance

```typescript
// ✅ DO serialize for fast init
const serialized = client.serialize();
localStorage.setItem('client-state', JSON.stringify(serialized));

// Next session
const saved = JSON.parse(localStorage.getItem('client-state') || '{}');
await client.init({ savedState: saved });
```

### 4. Use Public APIs When Possible

```typescript
// ❌ DON'T create states manually
const state = createExtensionStateNotFound();

// ✅ DO use client methods
const state = await client.init();
```

---

**For SDK Contributors**: See implementation in `bodhi-js-sdk/core/src/`, `bodhi-js-sdk/ext/src/`, and `setup-modal/src/`.

← Back to [Client State](../client-state.md) | [Onboarding](../onboarding.md) | [Extension SDK](../extension-sdk.md)
