---
name: bodhi-sdk
description: >
  Integrate apps with Bodhi App using bodhi-js-sdk. Covers BodhiProvider, useBodhi, access request flow,
  MCP tool calling, agentic chat, streaming, authentication, and troubleshooting. Always use this
  skill when a project imports @bodhiapp packages or builds apps connecting to Bodhi App, local LLMs, or MCP servers.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm:*), Bash(npx:*)
---

# Bodhi JS SDK Integration

## What is Bodhi App?

Bodhi App is a platform providing access to local and cloud LLM services and MCP tool servers through an OpenAI-compatible API. Third-party apps integrate via bodhi-js-sdk, which handles connectivity, resource consent, authentication, and API access.

## The Resource Consent Model

This is the central concept for any Bodhi App integration. Understanding this is essential — without it, API calls for MCPs will return empty results.

Apps don't get automatic access to a user's LLMs or MCPs. Instead:

1. **App declares what it needs** — during `login()`, the app specifies which resources it requires (MCP servers, user role)
2. **User reviews and consents** — a popup shows the user what the app is requesting; the user can approve all, partially approve, or deny
3. **App receives scoped access** — only approved resources are accessible via SDK APIs; unapproved ones are filtered out server-side
4. **Token carries claims** — the OAuth token includes claims for approved resources, enforced on every API call

**If your app uses MCPs, you must request them during `login()`.** Without requesting, `client.mcps.list()` returns nothing.

## Package Selection

| Package                        | Use Case                                     |
| ------------------------------ | -------------------------------------------- |
| `@bodhiapp/bodhi-js-react`     | React web apps (recommended, single install) |
| `@bodhiapp/bodhi-js`           | Vanilla JS/TS web apps                       |
| `@bodhiapp/bodhi-js-react-ext` | React Chrome extensions                      |
| `@bodhiapp/bodhi-js-ext`       | Vanilla JS Chrome extensions                 |

For extension development, see [extension-sdk.md](./extension-sdk.md).

## Quick Start (React + Vite)

### 1. Install

```bash
npm install @bodhiapp/bodhi-js-react
```

### 2. Register OAuth Client

Register at https://developer.getbodhi.app to get a `clientId`.

- Dev (localhost allowed): `https://main-id.getbodhi.app/realms/bodhi`
- Prod (real domains): `https://id.getbodhi.app/realms/bodhi` (SDK default)

### 3. Setup BodhiProvider

```tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

function App() {
  return (
    <BodhiProvider
      authClientId="your-client-id"
      clientConfig={{
        authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi', // dev server
      }}
    >
      <MainContent />
    </BodhiProvider>
  );
}
```

### 4. Login with Resource Requests

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function MainContent() {
  const { client, isOverallReady, isAuthenticated, login, showSetup } = useBodhi();

  if (!isOverallReady) return <button onClick={showSetup}>Setup Required</button>;

  if (!isAuthenticated) {
    return (
      <button
        onClick={() =>
          login({
            requested: {
              mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }],
            },
          })
        }
      >
        Login
      </button>
    );
  }

  return <ChatInterface />;
}
```

The `requested` field tells Bodhi App what resources your app needs. The user sees a consent popup listing these and can approve, modify, or deny each one.

### 5. Use Approved Resources

```tsx
// Only returns MCPs the user approved for your app
const { mcps } = await client.mcps.list();

// Chat works without resource requests (uses LLM directly)
const stream = client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
});
```

## BodhiProvider Props

```tsx
<BodhiProvider
  authClientId="your-client-id"       // Required (or provide client prop)
  clientConfig={{                       // Optional
    authServerUrl: '...',              // Auth server (default: prod)
    redirectUri: '...',                // OAuth callback URL (auto-computed)
    userRole: 'scope_user_user',       // Default role for login
    basePath: '/',                     // App base path
    logLevel: 'warn',
  }}
  basePath="/"                          // For sub-path deployments (GitHub Pages)
  callbackPath="/callback"              // OAuth callback route (auto-computed from basePath)
  handleCallback={true}                 // Auto-handle OAuth redirect (default: true)
  logLevel="warn"
>
```

## useBodhi() Hook

```tsx
const {
  client, // SDK client — all API calls go through this
  isOverallReady, // Client + server ready (use as main gate)
  isReady, // Client connected (extension or direct)
  isServerReady, // Server responding with status 'ready'
  isInitializing, // client.init() in progress
  isAuthenticated, // Valid OAuth token
  isAuthLoading, // Auth operation in progress
  canLogin, // isReady && !isAuthLoading
  isExtension, // Connected via Bodhi Browser extension
  isDirect, // Connected via direct HTTP
  login, // (options?: LoginOptions) => Promise<AuthState | void>
  logout, // () => Promise<void>
  showSetup, // Opens setup wizard modal
  hideSetup,
  clientState, // { status, mode, extensionId, url, server, error }
  auth, // { status, user, accessToken, error }
  setupState, // 'ready' | 'loading' | 'loaded'
} = useBodhi();
```

## Login with Resources (Standard Pattern)

Every app that uses MCPs should request them during login:

```tsx
await login({
  // What resources your app needs
  requested: {
    mcp_servers: [
      { url: 'https://mcp.exa.ai/mcp' }, // Web search
      { url: 'http://localhost:3001' }, // Local MCP server
    ],
  },

  // Optional overrides
  userRole: 'scope_user_power_user', // Default: from client config ('scope_user_user')
  flowType: 'popup', // Default: 'popup' (alternative: 'redirect')

  // Progress tracking
  onProgress: stage => {
    // 'requesting' → 'reviewing' → 'authenticating'
    setLoginStage(stage);
  },
});
```

### What Happens During Login

1. **`requesting`** — SDK posts to `/bodhi/v1/apps/request-access` with your app's client ID, requested resources, and flow type. This endpoint is anonymous — any app can request.
2. **`reviewing`** — A popup opens at the returned `review_url`. The user sees what resources your app is requesting and can approve all, approve some, or deny. SDK polls for the decision.
3. **`authenticating`** — Once approved, SDK performs OAuth 2.0 + PKCE with the granted scope. The token carries claims for approved resources.
4. **Done** — `isAuthenticated` becomes true. Approved resources are now available via `client.mcps.list()`.

### LoginOptions Reference

| Field            | Type                 | Default            | Description                                      |
| ---------------- | -------------------- | ------------------ | ------------------------------------------------ |
| `requested`      | `RequestedResources` | none               | MCPs your app needs                              |
| `userRole`       | `UserScope`          | client config      | `'scope_user_user'` or `'scope_user_power_user'` |
| `flowType`       | `FlowType`           | `'popup'`          | `'popup'` or `'redirect'`                        |
| `redirectUrl`    | `string`             | client redirectUri | Return URL for redirect flow                     |
| `onProgress`     | `(stage) => void`    | none               | Progress callback                                |
| `pollIntervalMs` | `number`             | `2000`             | Polling interval (popup flow)                    |
| `pollTimeoutMs`  | `number`             | `300000`           | Polling timeout (popup flow, 5min)               |

### Setting App-Level Resource Defaults

Since `requested` must be passed per-login call, create a wrapper for consistent behavior:

```tsx
// hooks/useBodhiApp.ts
import { useBodhi, type LoginOptions } from '@bodhiapp/bodhi-js-react';

const APP_RESOURCES = {
  mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }],
} as const;

export function useBodhiApp() {
  const bodhi = useBodhi();
  return {
    ...bodhi,
    login: (options?: LoginOptions) =>
      bodhi.login({
        requested: APP_RESOURCES,
        ...options,
      }),
  };
}
```

## Streaming Chat

```tsx
const stream = client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: prompt }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices?.[0]?.delta?.content || '';
  setResponse(prev => prev + content);
}
```

## Agentic Chat with MCP Tools

For apps that use MCP tools in chat (tool calling + agent loop), see **[agentic-patterns.md](./agentic-patterns.md)** for the complete implementation guide. Quick overview:

```tsx
// 1. Request MCP access during login
await login({ requested: { mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }] } });

// 2. List approved MCPs — tools available via tools_cache
const { mcps } = await client.mcps.list();
const tools = mcps[0].tools_cache ?? [];

// 3. Convert to chat tool format with mcp__slug__name naming
const chatTools = tools.map(t => ({
  type: 'function' as const,
  function: { name: `mcp__${mcps[0].slug}__${t.name}`, description: t.description, parameters: t.input_schema },
}));

const stream = client.chat.completions.create({ model, messages, tools: chatTools, stream: true });

// 4. Handle tool_calls in response → execute → feed back → loop
// See agentic-patterns.md for the full agent loop implementation
```

## Model Listing

`client.models.list()` returns an AsyncGenerator:

```tsx
const models: string[] = [];
for await (const model of client.models.list()) {
  models.push(model.id);
}
```

## Embeddings

Generate vector embeddings from text:

```tsx
const response = await client.embeddings.create({
  model: 'nomic-embed-text-v1.5',
  input: 'text to embed',
});
const embedding = response.data[0].embedding; // number[]
```

## Error Handling

```tsx
import { isApiResultSuccess, isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');
if (isApiResultSuccess(result)) {
  console.log(result.body);
} else if (isApiResultOperationError(result)) {
  console.error(result.error.message, result.error.type);
}
```

For streaming, errors are thrown — use try/catch:

```tsx
try {
  for await (const chunk of stream) {
    /* ... */
  }
} catch (err) {
  console.error('Stream error:', err instanceof Error ? err.message : err);
}
```

## Conditional Rendering Pattern

```tsx
function App() {
  const { isOverallReady, isAuthenticated, showSetup, login } = useBodhi();

  if (!isOverallReady) return <button onClick={showSetup}>Setup Required</button>;
  if (!isAuthenticated) return <button onClick={() => login({ requested: APP_RESOURCES })}>Login</button>;
  return <YourAppContent />;
}
```

## Connection Modes

- **Extension mode** (recommended): Via Bodhi Browser extension. SDK auto-detects `window.bodhiext`.
- **Direct mode** (experimental): Direct HTTP to `http://localhost:1135`. Requires Chrome 130+ LNA.
- SDK auto-detects best mode. Setup wizard (`showSetup()`) guides installation.

## Reference Files

- **[agentic-patterns.md](./agentic-patterns.md)** — MCP tool calling, agent loop, complete agentic chat component
- **[api-reference.md](./api-reference.md)** — Full client API (chat, models, embeddings, MCPs, auth, generic requests)
- **[auth-and-deployment.md](./auth-and-deployment.md)** — OAuth configuration, GitHub Pages deployment
- **[extension-sdk.md](./extension-sdk.md)** — Chrome extension development with @bodhiapp/bodhi-js-react-ext
- **[troubleshooting.md](./troubleshooting.md)** — Connection, auth, streaming issues, server states

## Key Source Files

- `bodhi-js-sdk/core/src/interface.ts` — UIClient interface definition
- `bodhi-js-sdk/core/src/openai-client-compat.ts` — Chat, Models, Embeddings, Mcps
- `bodhi-js-sdk/core/src/access-request.ts` — AccessRequestBuilder, polling logic
- `bodhi-js-sdk/web/src/direct-client.ts` — login() implementation with access request flow
- `bodhi-js-sdk/core/src/types/index.ts` — LoginOptions, LoginProgressStage, RequestedResources
- `bodhi-js-sdk/react-core/src/BodhiProvider.tsx` — React provider, callback handling
- `sdk-test-app/web/src/` — Reference app with full integration
- BodhiApp OpenAPI spec: https://github.com/BodhiSearch/BodhiApp/blob/main/openapi.json
