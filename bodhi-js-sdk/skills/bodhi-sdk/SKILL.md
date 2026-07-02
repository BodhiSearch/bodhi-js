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
2. **User reviews and consents** — the SDK sends the user to a Bodhi review screen (web: full-page redirect; Chrome extension: `chrome.identity` window) showing what the app is requesting; the user can approve all, partially approve, or deny
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
| `@bodhiapp/bodhi-js-cli`       | CLI/headless Node.js apps                    |

For extension development, see [extension-sdk.md](./extension-sdk.md).

## Type Import Paths

The SDK mirrors `@bodhiapp/ts-client`'s subpath layout. Never add `@bodhiapp/ts-client` as a direct dependency — every type you need is re-exported via the SDK package you already depend on.

| Import path                              | Contents                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bodhiapp/bodhi-js-react`               | App-facing types/classes: `BodhiProvider`, `useBodhi`, `BodhiError`, `BodhiApiError`, `unwrapResponse`, `AuthState`, `ClientState`, `UIClient`, `LoginOptions`, state/type guards |
| `@bodhiapp/bodhi-js-react/api`           | All ts-client management types: `ApiFormat`, `UserScope`, `RequestedResourcesV1`, `PaginatedAliasResponse`, `AliasResponse`, `Alias`, `ApiModel`, `Mcp`, …                        |
| `@bodhiapp/bodhi-js-react/api/openai`    | OpenAI-compat spec types                                                                                                                                                          |
| `@bodhiapp/bodhi-js-react/api/anthropic` | Anthropic spec types                                                                                                                                                              |
| `@bodhiapp/bodhi-js-react/api/gemini`    | Gemini spec types                                                                                                                                                                 |

(Same subpath layout for `@bodhiapp/bodhi-js-react-ext`, `@bodhiapp/bodhi-js`, `@bodhiapp/bodhi-js-ext`, `@bodhiapp/bodhi-js-core`.)

```ts
import { BodhiProvider, useBodhi, BodhiError } from '@bodhiapp/bodhi-js-react';
import type { ApiFormat, PaginatedAliasResponse } from '@bodhiapp/bodhi-js-react/api';
import type { UserScope, RequestedResourcesV1 } from '@bodhiapp/bodhi-js-react/api';
import type { components as Anthropic } from '@bodhiapp/bodhi-js-react/api/anthropic';
import type { components as Gemini } from '@bodhiapp/bodhi-js-react/api/gemini';
```

**Smell**: if you find yourself adding `@bodhiapp/ts-client` to your `package.json` or redefining a ts-client type locally, stop — the type is reachable via one of the `/api/*` subpaths above. If it genuinely is missing, file an SDK issue.

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
import { useBodhi, LoginOptionsBuilder } from '@bodhiapp/bodhi-js-react';

function MainContent() {
  const { isOverallReady, isAuthenticated, login, showSetup } = useBodhi();

  if (!isOverallReady) return <button onClick={showSetup}>Setup Required</button>;

  if (!isAuthenticated) {
    const loginOpts = new LoginOptionsBuilder().addMcpServer('https://mcp.exa.ai/mcp').build();

    return <button onClick={() => login(loginOpts)}>Login</button>;
  }

  return <ChatInterface />;
}
```

The `requested` field tells Bodhi App what resources your app needs. The user sees a consent screen listing these and can approve, modify, or deny each one. You can also construct LoginOptions directly:

```tsx
login({
  requested: {
    mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }],
  },
});
```

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
    basePath: '/',                     // App base path
    logLevel: 'warn',
  }}
  basePath="/"                          // For sub-path deployments (GitHub Pages)
  callbackPath="/callback"              // OAuth callback route (auto-computed from basePath)
  handleCallback={true}                 // Auto-handle OAuth redirect (default: true)
  logLevel="warn"
>
```

Most apps only need `authClientId` (plus `clientConfig.authServerUrl` for dev). Everything else has sensible defaults. The setup-modal props (`setupModal`, `autoProbe`, `defaultHost`) are covered in [Setup Modal](#setup-modal) — defaults are correct for the common case, so you usually don't set them.

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
  auth, // { status, user, accessToken, error, refreshToken, expiresAt, isTokenRefresh }
  setupState, // 'ready' | 'loading' | 'loaded'
} = useBodhi();
```

## Login with Resources (Standard Pattern)

Every app that uses MCPs should request them during login:

```tsx
await login({
  // What resources your app needs. The four booleans are UI drivers: they tell the
  // consent screen which controls to render; the user picks the actual grant (All / Specific).
  requested: {
    models_access: true, // show the model All/Specific access selector
    models_list: true, // show the "list all models" toggle
    mcps_access: true, // show the MCP All/Specific access selector
    mcps_list: true, // show the "list all MCPs" toggle
    mcp_servers: [
      { url: 'https://mcp.exa.ai/mcp' }, // Web search — slotted by-url MCP request
      { url: 'http://localhost:3001' }, // Local MCP server
    ],
  },

  // Optional overrides
  userRole: 'scope_user_power_user', // Default: 'scope_user_user'

  // Progress tracking
  onProgress: stage => {
    // 'requesting' → 'reviewing'
    setLoginStage(stage);
  },
});
```

### What Happens During Login (single-step)

1. **`requesting`** — SDK generates PKCE + state up front, builds the full Keycloak authorize URL, and posts to `/bodhi/v1/apps/request-access` with your app's client ID and requested resources. This endpoint is anonymous — any app can request.
2. **`reviewing`** — SDK sends the user to the returned `review_url` (web: full-page redirect; Chrome extension: `chrome.identity` window), passing the authorize URL and an error URL as query params. The user sees the requested controls and approves (all/some) or denies.
3. **Approve → Keycloak → back to your app** — On approve, the review page appends the freshly minted `scope_access_request:<id>` to the authorize URL and redirects straight to Keycloak; Keycloak returns to your registered `redirect_uri` with the code, which the SDK exchanges for tokens. There is **no polling and no intermediate callback into your app** between review and Keycloak.
4. **Deny/failure** — the review page redirects to your callback with an OAuth-style error (`error_source=bodhi`), which surfaces as an auth error.
5. **Done** — `isAuthenticated` becomes true. Approved resources are available via `client.mcps.list()`.

### LoginOptions Reference

| Field        | Type                   | Default             | Description                                          |
| ------------ | ---------------------- | ------------------- | ---------------------------------------------------- |
| `requested`  | `RequestedResourcesV1` | none                | Resource envelope (see below; version auto-injected) |
| `userRole`   | `UserScope`            | `'scope_user_user'` | `'scope_user_user'` or `'scope_user_power_user'`     |
| `onProgress` | `(stage) => void`      | none                | Progress callback (`'requesting'` → `'reviewing'`)   |

`RequestedResourcesV1` fields (pass through only — the SDK adds no defaults; the backend decides what to show/grant):

| Field           | Type                | Description                                                         |
| --------------- | ------------------- | ------------------------------------------------------------------- |
| `models_access` | `boolean`           | Render the model All/Specific access selector on the consent screen |
| `models_list`   | `boolean`           | Render the "list all models" toggle (list even non-granted models)  |
| `mcps_access`   | `boolean`           | Render the MCP All/Specific access selector                         |
| `mcps_list`     | `boolean`           | Render the "list all MCPs" toggle                                   |
| `mcp_servers`   | `{ url: string }[]` | Slotted by-url MCP requests (unchanged)                             |

### LoginOptionsBuilder (Recommended)

Fluent builder for constructing LoginOptions:

```tsx
import { LoginOptionsBuilder } from '@bodhiapp/bodhi-js-react';

const opts = new LoginOptionsBuilder()
  .setRole('scope_user_power_user')
  .setModelsAccess() // show model access selector
  .setModelsList() // show list-all-models toggle
  .setMcpsAccess()
  .setMcpsList()
  .addMcpServer('https://mcp.exa.ai/mcp')
  .addMcpServer('http://localhost:3001')
  .setOnProgress(stage => console.log(stage))
  .build();

await login(opts);
```

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

// 2. List approved MCPs — each has a path for proxy connection
const { mcps } = await client.mcps.list();

// 3. Create MCP client using createMcpClient(client, mcp.path) for tool discovery and execution
import { createMcpClient } from '@bodhiapp/bodhi-js-react/mcp';
const mcpClient = await createMcpClient(client, mcps[0].path);
const tools = await mcpClient.listTools();
// See agentic-patterns.md for the full agent loop implementation
```

### CLI MCP Usage

```typescript
import { CliClient } from '@bodhiapp/bodhi-js-cli';
import { createMcpClient } from '@bodhiapp/bodhi-js-cli/mcp';

const client = new CliClient({ authClientId, authServerUrl, serverUrl });
await client.login({
  requested: { mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }] },
  onReviewUrl: url => console.log(url),
});

const mcps = await client.mcps.list();
for (const mcp of mcps.mcps) {
  const mcpClient = await createMcpClient(client, mcp.path);
  const tools = await mcpClient.listTools();
  const result = await mcpClient.callTool({ name: 'search', arguments: { query: 'AI news' } });
  await mcpClient.close();
}
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

Use `instanceof` to discriminate errors. `BodhiApiError` (HTTP 4xx/5xx) extends `BodhiError` (operational: network, timeout, extension, auth):

```tsx
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

// Pattern 1: unwrapResponse — throws BodhiApiError on status >= 400
const result = await client.sendApiRequest('GET', '/bodhi/v1/info');
const body = unwrapResponse(result); // throws BodhiApiError if error

// Pattern 2: instanceof discrimination
try {
  const body = unwrapResponse(result);
} catch (err) {
  if (err instanceof BodhiApiError) {
    console.error('HTTP error', err.status, err.body);
  } else if (err instanceof BodhiError) {
    console.error('Operational error', err.code, err.message);
  }
}
```

For streaming, errors are thrown during iteration — use try/catch:

```tsx
try {
  for await (const chunk of stream) {
    /* ... */
  }
} catch (err) {
  if (err instanceof BodhiApiError) {
    console.error('Stream HTTP error:', err.status);
  } else if (err instanceof BodhiError) {
    console.error('Stream error:', err.message);
  }
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

## Setup Modal

The SDK ships with a built-in setup modal that connects the user to a Bodhi App server. `BodhiProvider` mounts it for you — you never render it. You only interact with it through two things from `useBodhi()`: the `isOverallReady` gate and `showSetup()`.

### Default behavior (you don't configure anything)

With defaults (`setupModal='setup-modal-v2'`, `autoProbe={true}`), on mount the SDK silently probes for a running server. The probe target is, in order: a previously-confirmed URL cached in `localStorage` → the `defaultHost` prop → `http://localhost:1135`.

- **Server is up and ready** → `isOverallReady` becomes true, no modal is ever shown. This is the happy path.
- **Server not found / not ready** → `isOverallReady` stays false. Call `showSetup()` to open the modal; the user confirms a server URL and connects, or follows the cloud-signup link. On success the modal closes itself and `isOverallReady` flips to true.

That is the entire integration — the conditional-render gate already covers it:

```tsx
function App() {
  const { isOverallReady, isAuthenticated, showSetup, login } = useBodhi();

  if (!isOverallReady) return <button onClick={showSetup}>Setup Required</button>;
  if (!isAuthenticated) return <button onClick={() => login()}>Login</button>;
  return <YourAppContent />;
}
```

### The two override props (most apps need neither)

- **`defaultHost`** — change the URL probed when nothing is cached (e.g. a non-default port). Production omits it and gets `http://localhost:1135`.

  ```tsx
  <BodhiProvider authClientId="your-client-id" defaultHost="http://localhost:8080">
  ```

- **`autoProbe={false}`** — skip the headless probe on mount (use when you drive connectivity yourself). The modal still probes when opened via `showSetup()`.

### setup-modal-v2 vs the legacy wizard

`setup-modal-v2` (default) is a direct-connection (LNA) flow: probe localhost, and if that fails, offer cloud signup. **It does not handle extension installation.** If your app connects via the Bodhi Browser extension (`connectionMode: 'extension'`, e.g. for browsers without LNA), either:

- set `setupModal="setup-modal"` to use the legacy multi-step wizard (which guides extension install), or
- manage setup in your own UI with `client.setConnectionMode('extension')` + `client.testExtensionConnectivity()`.

## Connection Modes

- **Direct mode** (default for web apps): HTTP to `http://localhost:1135` via Chrome 130+ LNA. This is what setup-modal-v2 configures.
- **Extension mode**: via the Bodhi Browser extension (SDK auto-detects `window.bodhiext`). Used by the `*-ext` packages and browsers without LNA.

## Reference Files

- **[agentic-patterns.md](./agentic-patterns.md)** — MCP tool calling, agent loop, complete agentic chat component
- **[api-reference.md](./api-reference.md)** — Full client API (chat, models, embeddings, MCPs, auth, generic requests)
- **[auth-and-deployment.md](./auth-and-deployment.md)** — OAuth configuration, GitHub Pages deployment
- **[extension-sdk.md](./extension-sdk.md)** — Chrome extension development with @bodhiapp/bodhi-js-react-ext
- **[troubleshooting.md](./troubleshooting.md)** — Connection, auth, streaming issues, server states

## Key Source Files

- `bodhi-js-sdk/core/src/interface.ts` — UIClient interface definition
- `bodhi-js-sdk/core/src/openai-client-compat.ts` — Chat, Models, Embeddings, Mcps (list only)
- `bodhi-js-sdk/core/src/mcp.ts` — createMcpClient factory, McpTransportProvider interface
- `bodhi-js-sdk/cli/src/cli-client.ts` — CliClient with login(), createMcpTransportConfig()
- `bodhi-js-sdk/core/src/access-request.ts` — AccessRequestBuilder, LoginOptionsBuilder
- `bodhi-js-sdk/core/src/oauth.ts` — PKCE, buildAuthorizeUrl/buildReviewUrl/buildErrorUrl (single-step flow)
- `bodhi-js-sdk/web/src/direct-client.ts` — login() implementation with access request flow
- `bodhi-js-sdk/core/src/types/index.ts` — LoginOptions, LoginProgressStage
- `bodhi-js-sdk/react-core/src/BodhiProvider.tsx` — React provider, callback handling, setupModal variant selection
- `bodhi-js-sdk/react-core/src/SetupModalV2Processor.tsx` — default setup modal: auto-probe, defaultHost, connection cache
- `sdk-test-app/web/src/` — Reference app with full integration
- BodhiApp OpenAPI spec: https://github.com/BodhiSearch/BodhiApp/blob/main/openapi.json
