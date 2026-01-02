# Extension SDK

Guide for building Chrome extensions with the Bodhi JS SDK.

## Overview

The Bodhi JS SDK provides specialized packages for Chrome extension development, particularly for extension popup and options pages that need to communicate with local LLM servers.

**Use Cases**:

- Chrome extension popup UI with React
- Chrome extension options page
- Extension-to-extension communication
- Background script integration

## Installation

### Recommended: React Extension Preset

For React-based extensions, use the preset package:

```bash
npm install @bodhiapp/bodhi-js-react-ext
```

This single package includes everything you need.

### Advanced: Vanilla JS or Custom Config

For vanilla JavaScript extensions or custom client configuration:

```bash
npm install @bodhiapp/bodhi-js-ext
```

For vanilla JS with React bindings (manual client):

```bash
npm install @bodhiapp/bodhi-js-react-core @bodhiapp/bodhi-js-ext
```

See [Client Injection](./advanced/client-injection.md) for advanced scenarios.

### Setup Modal Integration (Required)

**Critical**: After installing, run the setup-modal CLI tool once to integrate the setup wizard:

```bash
npx @bodhiapp/bodhi-js-core setup-modal
```

**What this does**:

1. Copies `setup-modal.html` to your extension directory
2. Updates `manifest.json` with required `web_accessible_resources` entry
3. Ensures the setup wizard can be loaded from your extension

**Without this step**, the setup modal will not work in your extension.

For detailed setup instructions, see [Extension Installation Guide](./installation-extension.md).

## Package Comparison

| Package                         | Best For                        | Client Creation         | Import                          |
| ------------------------------- | ------------------------------- | ----------------------- | ------------------------------- |
| `@bodhiapp/bodhi-js-react-ext`  | React extensions (90% of cases) | **Auto** (authClientId) | `@bodhiapp/bodhi-js-react-ext`  |
| `@bodhiapp/bodhi-js-ext`        | Vanilla JS extensions           | **Manual**              | `@bodhiapp/bodhi-js-ext`        |
| `@bodhiapp/bodhi-js-react-core` | Custom client config            | **Manual**              | `@bodhiapp/bodhi-js-react-core` |

## Quick Setup (React Extension)

### Extension Popup (Recommended)

```typescript
// popup.tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-ext';

function Popup() {
  return (
    <BodhiProvider authClientId="ext-client-id">
      <PopupUI />
    </BodhiProvider>
  );
}
```

**That's it!** Just pass `authClientId` - the SDK auto-creates and configures the extension client.

### Extension Options Page

```typescript
// options.tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-ext';

function Options() {
  return (
    <BodhiProvider authClientId="ext-client-id">
      <OptionsUI />
    </BodhiProvider>
  );
}
```

## Advanced Setup (Manual Client)

### Vanilla JS Extension

```typescript
// popup.ts
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('ext-client-id');

await client.init();

// Same API as WebUIClient
const result = await client.sendApiRequest('GET', '/v1/models');
```

### React with Custom Client

```typescript
// popup.tsx
import { BodhiProvider, ExtUIClient } from '@bodhiapp/bodhi-js-react-ext';

const client = new ExtUIClient('ext-client-id', {
  logLevel: 'debug',
});

function Popup() {
  return (
    <BodhiProvider client={client}>
      <PopupUI />
    </BodhiProvider>
  );
}
```

## ExtUIClient Configuration

When using manual client creation, all fields are optional with sensible defaults:

```typescript
interface ExtUIClientParams {
  authServerUrl?: string; // OAuth server URL (default: 'https://id.getbodhi.app')
  userScope?: UserScope; // User scope (default: UserScope.Standard)
  basePath?: string; // App base path (default: '/')
  logLevel?: LogLevel; // Logging level (default: LogLevel.Info)
  initParams?: {
    extension?: {
      timeoutMs?: number; // Discovery timeout (default: 5000ms)
      attempts?: number; // Discovery attempts (default: 3)
      attemptWaitMs?: number; // Wait between attempts (default: 500ms)
      attemptTimeout?: number; // Per-attempt timeout (default: 500ms)
    };
  };
}
```

### Example Configuration

For most cases, no config is needed:

```typescript
const client = new ExtUIClient('ext-client-id');
```

For custom settings:

```typescript
const client = new ExtUIClient('ext-client-id', {
  userScope: 'scope_user_power_user',
  logLevel: 'debug',
  initParams: {
    extension: {
      timeoutMs: 10000,
      attempts: 5,
    },
  },
});
```

## Chrome Identity OAuth Flow

Extensions use `chrome.identity.launchWebAuthFlow()` for OAuth:

### Automatic OAuth (Recommended)

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function LoginButton() {
  const { login, isAuthenticated } = useBodhi();

  if (isAuthenticated) {
    return <div>Logged in</div>;
  }

  return <button onClick={login}>Login with OAuth</button>;
}
```

**What happens**:

1. Calls `chrome.identity.launchWebAuthFlow()`
2. Opens OAuth popup
3. User authenticates
4. Popup closes with auth code
5. SDK exchanges code for tokens
6. Tokens stored in `chrome.storage.session`

### Manual OAuth Flow

```typescript
const { client } = useBodhi();

try {
  await client.login();
  console.log('Login successful');
} catch (err) {
  console.error('Login failed:', err);
}
```

## Extension-Specific Features

### sendExtRequest

Call extension-specific actions:

```typescript
const { client } = useBodhi();

// Get host extension ID
const extensionId = await client.sendExtRequest('get_extension_id');
console.log('Host extension ID:', extensionId);
```

**Valid sendExtRequest Actions**:

- `LOGIN` - Initiate OAuth login flow
- `LOGOUT` - Clear authentication state
- `GET_AUTH_STATE` - Get current auth state
- `DISCOVER_EXTENSION` - Discover host extension
- `GET_EXTENSION_ID` - Get host extension ID
- `SET_EXTENSION_ID` - Set host extension ID

````

### chrome.storage Integration

Tokens automatically stored in `chrome.storage.session`:

```typescript
// Stored automatically by SDK with prefixes:
// User prefs: bodhi-js-sdk:ext:*
// OAuth tokens (extension mode): bodhi-js-sdk:ext:ext:*
// OAuth tokens (direct mode): bodhi-js-sdk:ext:direct:*

// Manual access (not recommended)
chrome.storage.session.get(['bodhi-js-sdk:ext:ext:ACCESS_TOKEN'], (result) => {
  console.log('Access token:', result['bodhi-js-sdk:ext:ext:ACCESS_TOKEN']);
});
````

## Extension Manifest Configuration

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "My Bodhi Extension",
  "version": "1.0.0",

  "permissions": [
    "storage", // For chrome.storage.session
    "identity" // For chrome.identity.launchWebAuthFlow
  ],

  "host_permissions": [
    "https://id.getbodhi.app/*" // OAuth server
  ],

  "action": {
    "default_popup": "popup.html"
  },

  "options_page": "options.html"
}
```

## Complete Extension Example

### Popup with Chat Interface

```typescript
// popup.tsx
import { useState } from 'react';
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react';

const client = new ExtUIClient('ext-client-id');

function ChatPopup() {
  const { client, isOverallReady, isAuthenticated, login } = useBodhi();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');

  if (!isOverallReady) {
    return <div>Connecting...</div>;
  }

  if (!isAuthenticated) {
    return <button onClick={login}>Login</button>;
  }

  const handleSubmit = async () => {
    setResponse('');
    const stream = client.streamChat('gemma-3n-e4b-it', prompt);

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      setResponse(prev => prev + content);
    }
  };

  return (
    <div style={{ width: '400px', padding: '16px' }}>
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Ask me anything..."
      />
      <button onClick={handleSubmit}>Send</button>
      {response && <div>{response}</div>}
    </div>
  );
}

function Popup() {
  return (
    <BodhiProvider client={client}>
      <ChatPopup />
    </BodhiProvider>
  );
}

export default Popup;
```

### Options Page

```typescript
// options.tsx
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react';

const client = new ExtUIClient('ext-client-id');

function OptionsPage() {
  const { clientState, isOverallReady, showSetup } = useBodhi();

  return (
    <div>
      <h1>Extension Settings</h1>

      <section>
        <h2>Connection Status</h2>
        <p>Mode: {clientState.mode}</p>
        <p>Server Status: {clientState.server.status}</p>
        {!isOverallReady && (
          <button onClick={showSetup}>Configure Connection</button>
        )}
      </section>

      <section>
        <h2>Authentication</h2>
        <AuthSection />
      </section>
    </div>
  );
}

export default function Options() {
  return (
    <BodhiProvider client={client}>
      <OptionsPage />
    </BodhiProvider>
  );
}
```

## Background Script Integration

### BodhiExtClient (Advanced Use)

`BodhiExtClient` runs in background scripts and communicates directly with bodhi-browser-ext. Most applications should use `ExtUIClient` in UI components instead.

```typescript
// background.ts
import { BodhiExtClient } from '@bodhiapp/bodhi-js-ext';

const client = new BodhiExtClient('your-client-id', {
  authServerUrl: 'https://id.getbodhi.app/realms/bodhi',
  logLevel: 'debug',
});

// Initialize and discover bodhi-browser-ext
await client.init();

// Public API methods:
const state = client.getState(); // 'ready' | 'setup' | 'error'
const authState = await client.getAuthState(); // Get auth state
await client.login(); // Initiate OAuth login
await client.logout(); // Clear auth state
```

> **Important**: BodhiExtClient is a low-level client for advanced background script integration. For popup/options UI, use `ExtUIClient` instead, which provides the full API (sendApiRequest, stream, streamChat, etc.).

### Using ExtUIClient in Background Scripts

For most use cases, use `ExtUIClient` in background scripts:

```typescript
// background.ts
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('your-client-id');

await client.init();

// Full API available
const result = await client.sendApiRequest('GET', '/v1/models');
const stream = client.stream('/v1/chat/completions', { model, messages });
```

## Extension-Specific Patterns

### Popup Size Constraints

```typescript
function CompactPopup() {
  return (
    <div style={{
      width: '400px',
      minHeight: '300px',
      maxHeight: '600px',
      overflow: 'auto',
    }}>
      <ChatInterface />
    </div>
  );
}
```

### Persistent Storage

```typescript
// Save user preferences
async function savePreference(key: string, value: any) {
  await chrome.storage.local.set({ [key]: value });
}

// Load user preferences
async function loadPreference(key: string) {
  const result = await chrome.storage.local.get(key);
  return result[key];
}
```

### Extension Lifecycle

```typescript
import { useEffect } from 'react';

function ExtensionLifecycle() {
  useEffect(() => {
    // Initialize when popup opens
    console.log('Popup opened');

    return () => {
      // Cleanup when popup closes
      console.log('Popup closed');
    };
  }, []);
}
```

## Debugging Extensions

### Chrome DevTools

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Inspect views: popup.html"
4. DevTools opens for popup

### Logging

```typescript
const client = new ExtUIClient('client-id', {
  logLevel: 'debug', // Enable detailed logs
});

// Logs appear in extension DevTools
```

### Common Issues

**Extension not connecting to host**:

- Verify bodhi-browser-ext is installed
- Check extension ID in manifest
- Reload both extensions

**OAuth popup blocked**:

- Ensure `identity` permission in manifest
- Check host_permissions for auth server

**Storage errors**:

- Verify `storage` permission
- Check quota limits

## Best Practices

### 1. Handle Popup Lifecycle

```typescript
// ✅ Initialize on mount, cleanup on unmount
useEffect(() => {
  const init = async () => {
    await client.init();
  };
  init();

  return () => {
    // Cleanup if needed
  };
}, []);
```

### 2. Use chrome.storage Appropriately

```typescript
// ❌ DON'T use localStorage in extensions
localStorage.setItem('key', 'value');

// ✅ DO use chrome.storage
chrome.storage.local.set({ key: 'value' });
```

### 3. Keep Popup Lightweight

```typescript
// ✅ Lazy load heavy components
const HeavyComponent = lazy(() => import('./Heavy'));

function Popup() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### 4. Test in Multiple Browsers

- Chrome
- Edge (Chromium-based)
- Brave

## Advanced: Extension Internals

For SDK contributors or advanced extension integrations:

- **Message Protocol** - See [Message Protocols (Internals)](./internals/message-protocols.md) for ext2ext protocol details, message types, discovery constants, and broadcast mechanisms.
- **State Serialization** - Extension state can be serialized to skip discovery on subsequent initializations (see internals documentation).

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Bodhi Browser Extension Repository](https://github.com/BodhiSearch/bodhi-browser)

---

← Back to [Error Handling](./error-handling.md) | Continue to [API Reference](./api-reference.md) →
