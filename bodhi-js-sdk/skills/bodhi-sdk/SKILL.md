---
name: bodhi-sdk
description: >
  Integrate web apps with bodhi-js-sdk for local LLM access. Use when working with bodhi SDK, BodhiProvider,
  useBodhi, streaming chat, bodhi authentication, bodhi setup, or troubleshooting bodhi connection/auth issues.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm:*), Bash(npx:*)
---

# Bodhi JS SDK Integration

Guide for integrating web applications with bodhi-js-sdk — a TypeScript SDK that connects apps to the Bodhi App platform for local + cloud LLM services through an OpenAI-compatible API.

## Package Selection

| Package                        | Use Case                                     |
| ------------------------------ | -------------------------------------------- |
| `@bodhiapp/bodhi-js-react`     | React web apps (recommended, single install) |
| `@bodhiapp/bodhi-js`           | Vanilla JS/TS web apps                       |
| `@bodhiapp/bodhi-js-react-ext` | React Chrome extensions                      |
| `@bodhiapp/bodhi-js-ext`       | Vanilla JS Chrome extensions                 |

For extension development, see the `bodhi-sdk-extension` skill. For MCP/toolset integration or multi-tenant patterns, see the `bodhi-sdk-advanced` skill.

## Quick Start (React + Vite)

### 1. Install

```bash
npm install @bodhiapp/bodhi-js-react
```

### 2. Register OAuth Client

Register at https://developer.getbodhi.app to get a `clientId`. For local development, use the dev auth server which allows `localhost` origins.

### 3. Wrap App with BodhiProvider

```tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

function App() {
  return (
    <BodhiProvider authClientId="your-client-id">
      <MainContent />
    </BodhiProvider>
  );
}
```

### 4. Use the SDK

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function MainContent() {
  const { client, isOverallReady, isAuthenticated, login, showSetup } = useBodhi();

  if (!isOverallReady) return <button onClick={showSetup}>Setup Required</button>;
  if (!isAuthenticated) return <button onClick={() => login()}>Login</button>;

  return <ChatInterface />;
}
```

## BodhiProvider Props

```tsx
<BodhiProvider
  authClientId="your-client-id"       // Required (or provide client prop)
  clientConfig={{                       // Optional
    authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi',  // Dev server (use for localhost)
    redirectUri: 'http://localhost:5173/callback',
    basePath: '/',
    logLevel: 'warn',
  }}
  basePath="/"                          // App base path (for sub-path deployments)
  callbackPath="/callback"              // OAuth callback route (auto-computed from basePath)
  handleCallback={true}                 // Auto-handle OAuth redirect (default: true)
  modalHtmlPath="/setup-modal.html"     // Optional setup modal HTML path
  logLevel="warn"                       // Log level (default: 'warn')
>
```

Alternative: pass a pre-built client instead of `authClientId`:

```tsx
import { WebUIClient, BodhiProvider } from '@bodhiapp/bodhi-js-react';

const client = new WebUIClient('your-client-id', {
  authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi',
  redirectUri: `${window.location.origin}/callback`,
  logLevel: 'debug',
});

<BodhiProvider client={client}>
  <App />
</BodhiProvider>;
```

## useBodhi() Hook

```tsx
const {
  // Client instance — all API calls go through this
  client,

  // Connection state (most common checks)
  isOverallReady, // true when BOTH client and server ready (use this for main gate)
  isReady, // Client connected (extension detected or direct URL set)
  isServerReady, // Server responding with status 'ready'
  isInitializing, // client.init() in progress

  // Auth state
  isAuthenticated, // User has valid OAuth token
  isAuthLoading, // Auth operation in progress
  canLogin, // isReady && !isAuthLoading

  // Connection mode
  isExtension, // Connected via Bodhi Browser extension
  isDirect, // Connected via direct HTTP

  // Actions
  login, // (options?: LoginOptions) => Promise<AuthState | void>
  logout, // () => Promise<void>
  showSetup, // () => Promise<void>  — opens setup wizard modal
  hideSetup, // () => void

  // Raw state (when you need full details)
  clientState, // ClientContextState: { status, mode, extensionId, url, server, error }
  auth, // AuthState: { status, user, accessToken, error }
  setupState, // 'ready' | 'loading' | 'loaded'
} = useBodhi();
```

## Streaming Chat

```tsx
import { useState } from 'react';
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function ChatInterface() {
  const { client } = useBodhi();
  const [response, setResponse] = useState('');

  const sendMessage = async (prompt: string, model: string) => {
    setResponse('');

    const stream = client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      setResponse(prev => prev + content);
    }
  };

  return (/* your UI */);
}
```

Non-streaming variant:

```tsx
const result = await client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
});
const content = result.choices[0].message.content;
```

## Model Listing

`client.models.list()` returns an `AsyncGenerator`. Collect into an array:

```tsx
const loadModels = async () => {
  const models: string[] = [];
  for await (const model of client.models.list()) {
    models.push(model.id);
  }
  return models;
};
```

Single model lookup:

```tsx
const model = await client.models.retrieve('gemma-3n-e4b-it');
```

## Embeddings

```tsx
const result = await client.embeddings.create({
  model: 'nomic-embed-text-v1.5',
  input: 'Text to embed',
});
// result.data[0].embedding — float array
```

## Error Handling

The SDK uses type guards for result-based error handling:

```tsx
import { isApiResultSuccess, isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultSuccess(result)) {
  console.log(result.body); // Typed response body
} else if (isApiResultOperationError(result)) {
  console.error(result.error.message, result.error.type);
}
```

For streaming, errors are thrown directly — use try/catch:

```tsx
try {
  for await (const chunk of stream) {
    /* ... */
  }
} catch (err) {
  console.error('Stream error:', err instanceof Error ? err.message : err);
}
```

## Authentication

**Dev environment** (allows localhost):

- Auth server: `https://main-id.getbodhi.app/realms/bodhi`
- Register at: https://developer.getbodhi.app

**Prod environment** (real domains only):

- Auth server: `https://id.getbodhi.app/realms/bodhi`

OAuth callback is handled automatically by BodhiProvider when `handleCallback={true}` (default). No custom routes needed — the provider reads `code` and `state` from the URL, processes the token exchange, and cleans the URL.

## Connection Modes

- **Extension mode** (recommended): Via Bodhi Browser extension. SDK auto-detects `window.bodhiext`.
- **Direct mode** (experimental): Direct HTTP to `http://localhost:1135`. Requires Chrome 130+ LNA support.
- SDK auto-detects the best mode. The setup wizard (`showSetup()`) guides users through installation.

## Conditional Rendering Pattern

The standard pattern gates content behind connection + auth checks:

```tsx
function App() {
  const { isOverallReady, isAuthenticated, showSetup, login } = useBodhi();

  if (!isOverallReady) {
    return <button onClick={showSetup}>Setup Required</button>;
  }

  if (!isAuthenticated) {
    return <button onClick={() => login()}>Login</button>;
  }

  return <YourAppContent />;
}
```

## Detailed References

For deeper topics, see these supporting files:

- **[api-reference.md](./api-reference.md)** — Full client API surface (chat, models, embeddings, generic requests, auth methods)
- **[auth-and-deployment.md](./auth-and-deployment.md)** — OAuth configuration details, GitHub Pages deployment with basePath
- **[troubleshooting.md](./troubleshooting.md)** — Common issues: connection failures, auth errors, streaming problems, server states

## Key Source Files

When implementing, explore these for authoritative API details:

- `bodhi-js-sdk/core/src/interface.ts` — UIClient interface definition
- `bodhi-js-sdk/core/src/openai-client-compat.ts` — Chat, Models, Embeddings resource classes
- `bodhi-js-sdk/core/src/types/` — ClientState, AuthState, ApiResponseResult definitions
- `bodhi-js-sdk/react-core/src/BodhiProvider.tsx` — Provider implementation and state mapping
- `bodhi-js-sdk/docs/` — 20+ comprehensive developer guides
- `sdk-test-app/web/src/` — Real-world reference app with full integration
