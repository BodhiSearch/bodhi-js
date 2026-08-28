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
| `@bodhiapp/bodhi-js-react/api`           | All ts-client management types: `ApiFormat`, `UserScope`, `PaginatedAliasResponse`, `AliasResponse`, `Alias`, `ApiModel`, `Mcp`, …                                                |
| `@bodhiapp/bodhi-js-react/api/openai`    | OpenAI-compat spec types                                                                                                                                                          |
| `@bodhiapp/bodhi-js-react/api/anthropic` | Anthropic spec types                                                                                                                                                              |
| `@bodhiapp/bodhi-js-react/api/gemini`    | Gemini spec types                                                                                                                                                                 |

(Same subpath layout for `@bodhiapp/bodhi-js-react-ext`, `@bodhiapp/bodhi-js`, `@bodhiapp/bodhi-js-ext`, `@bodhiapp/bodhi-js-core`.)

```ts
import { BodhiProvider, useBodhi, BodhiError } from '@bodhiapp/bodhi-js-react';
import type { ApiFormat, PaginatedAliasResponse } from '@bodhiapp/bodhi-js-react/api';
import type { UserScope } from '@bodhiapp/bodhi-js-react/api';
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
    const loginOpts = new LoginOptionsBuilder().setMcps().build();

    return <button onClick={() => login(loginOpts)}>Login</button>;
  }

  return <ChatInterface />;
}
```

The login options tell Bodhi App which access sections your app requests (models, MCPs, role). The user sees a consent page and picks the actual grant — which models, which MCPs, what role — before approving or denying. You can also construct LoginOptions directly:

```tsx
login({ mcps: true });
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

## Login with Scoped Access (Standard Pattern)

Login is a standard OAuth authorization-code flow: the SDK navigates the user to
BodhiApp's consent page (`${serverUrl}/ui/apps/auth/`) with your client ID, PKCE, and
a scope string it composes from the options below. The user reviews and grants access
(which models/MCPs, role) on the consent page; Keycloak then returns the code to your
registered `redirect_uri` and the SDK exchanges it for tokens.

```tsx
await login({
  // Role ceiling the app requests; absent → 'scope_user_user'. Requesting
  // power_user renders a downgrade selector on the consent page.
  role: 'scope_user_power_user',

  // Section flags: undefined → requested (server default), true → requested
  // explicitly, false → suppressed. Both false = a valid role-only grant.
  llms: true, // model access section on the consent page
  mcps: true, // MCP access section on the consent page

  // Extra scope tokens forwarded verbatim to Keycloak (passthrough escape hatch).
  extraScopes: ['my_custom_scope'],

  // Progress tracking
  onProgress: stage => {
    // 'reviewing' → 'authenticating'
    // ('authenticating' only fires in the extension/chrome.identity flow; the web flow
    //  does a full-page redirect at 'reviewing', ending the JS context.)
    setLoginStage(stage);
  },
});
```

### What Happens During Login

1. **`reviewing`** — SDK generates fresh PKCE + state, composes the scope string (`openid profile email roles` + role token + `scope_apps:llms`/`scope_apps:mcps` flags + `extraScopes`), and navigates the user to `${serverUrl}/ui/apps/auth/` (web: full-page redirect; Chrome extension: `chrome.identity` window). No pre-registration request — the navigation itself is the request.
2. **Consent** — the user sees the requested sections (model/MCP pickers, role) and approves or denies. Which models and MCPs are granted is the user's choice on the consent page — the app only requests the sections.
3. **Approve → Keycloak → back to your app** — BodhiApp composes the Keycloak authorize URL (appending the server-side `scope_access_request:<id>`), Keycloak SSO returns to your registered `redirect_uri` with `code` + `state`, and the SDK exchanges the code for tokens at Keycloak's token endpoint.
4. **Deny/failure** — BodhiApp redirects to your `redirect_uri` with `error`, `error_description`, `error_source=bodhi`, and your `state`, which the SDK surfaces as an auth error (`access_request_denied` for a deny). An unknown client or unregistered `redirect_uri` renders an error on the consent page itself — no redirect reaches your app.
5. **Done** — `isAuthenticated` becomes true. Approved resources are available via `client.mcps.list()`.

### LoginOptions Reference

| Field         | Type                | Default               | Description                                                                                        |
| ------------- | ------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `role`        | `UserScope`         | `'scope_user_user'`   | Role ceiling: `'scope_user_user'` or `'scope_user_power_user'`                                     |
| `llms`        | `boolean`           | undefined (requested) | Model access section: `false` suppresses it (`scope_apps:llms:false`)                              |
| `mcps`        | `boolean`           | undefined (requested) | MCP access section: `false` suppresses it (`scope_apps:mcps:false`)                                |
| `reauthorize` | `boolean`           | `false`               | Re-consent with prefill while already authenticated (see below)                                    |
| `extraScopes` | `string[]`          | none                  | Scope tokens forwarded verbatim to Keycloak (`scope_access_request:*` is reserved and rejected)    |
| `onProgress`  | `(stage) => void`   | none                  | Progress callback (`'reviewing'` → `'authenticating'`)                                             |

### LoginOptionsBuilder (Recommended)

Fluent builder for constructing LoginOptions:

```tsx
import { LoginOptionsBuilder } from '@bodhiapp/bodhi-js-react';

const opts = new LoginOptionsBuilder()
  .setRole('scope_user_power_user')
  .setLlms() // request the model access section
  .setMcps() // request the MCP access section
  .addExtraScope('my_custom_scope')
  .setOnProgress(stage => console.log(stage))
  .setReauthorize() // re-consent with prefill while already authenticated (see below)
  .build();

await login(opts);
```

### Re-consenting While Authenticated (`reauthorize`)

By default, calling `login()` while already authenticated is a no-op — it returns the existing session without re-running the flow. This means an app can't ask for _more_ access (MCP access, a higher role) mid-session without logging out first.

Set `reauthorize: true` to run the consent flow **even while authenticated**. The SDK reads the `access_request_id` claim from the current access token and sends it as `source_access_request_id`, so the consent page pre-populates from what the user already granted (with an explicit reauthorization banner), and on approval the newly granted tokens **replace** the stored ones. Prior grants stay live; denying on the consent page surfaces an auth error and leaves the existing tokens untouched.

```tsx
// User is already logged in; app now wants the power_user role.
await login({ reauthorize: true, role: 'scope_user_power_user' });
```

To force a completely fresh login instead, `logout()` then `login()`.

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
// 1. Request MCP access during login — the user grants specific MCPs on the consent page
await login({ mcps: true });

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
  mcps: true,
  onAuthUrl: url => console.log(url), // consent-page URL — open in browser or print
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
  if (!isAuthenticated) return <button onClick={() => login({ mcps: true })}>Login</button>;
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
- `bodhi-js-sdk/core/src/login-options.ts` — LoginOptionsBuilder
- `bodhi-js-sdk/core/src/oauth.ts` — PKCE, buildLoginScope/buildConsentUrl (consent flow)
- `bodhi-js-sdk/core/src/login-flow.ts` — performConsentLogin shared orchestration
- `bodhi-js-sdk/core/src/oauth-callback.ts` — callback parsing/classification (deny detection)
- `bodhi-js-sdk/core/src/types/index.ts` — LoginOptions, LoginProgressStage
- `bodhi-js-sdk/react-core/src/BodhiProvider.tsx` — React provider, callback handling, setupModal variant selection
- `bodhi-js-sdk/react-core/src/SetupModalV2Processor.tsx` — default setup modal: auto-probe, defaultHost, connection cache
- `sdk-test-app/web/src/` — Reference app with full integration
- BodhiApp OpenAPI spec: https://github.com/BodhiSearch/BodhiApp/blob/main/openapi.json
