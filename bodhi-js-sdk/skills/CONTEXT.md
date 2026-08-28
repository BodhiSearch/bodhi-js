# bodhi-js-sdk Context for Skill Creation

## SDK Overview

- What: TypeScript SDK monorepo (6 packages) connecting web/extension apps to Bodhi App platform
- Architecture: Web App <-> SDK <-> Extension/Direct <-> Local LLM Server
- Package dependency graph (core -> web/ext -> react-core -> react/react-ext)

## Package Selection Guide

| Package                      | When to Use                               |
| ---------------------------- | ----------------------------------------- |
| @bodhiapp/bodhi-js-react     | React web apps (90% case, single install) |
| @bodhiapp/bodhi-js-react-ext | React Chrome extensions                   |
| @bodhiapp/bodhi-js           | Vanilla JS web apps                       |
| @bodhiapp/bodhi-js-ext       | Vanilla JS Chrome extensions              |
| @bodhiapp/bodhi-js-cli       | CLI/headless Node.js apps                 |

## Public API Surface (VERIFIED from source code)

### BodhiProvider props (react/src/BodhiProvider.tsx preset extends react-core/src/BodhiProvider.tsx)

Preset-only (react/react-ext, auto-create the client):

- authClientId?: string — for auto-creation of WebUIClient
- clientConfig?: WebUIClientParams — optional (authServerUrl, redirectUri, basePath, logLevel, apiTimeoutMs, storage, initialTokens, initParams)
- client?: UIClient — custom client override (skips auto-creation)

Core (forwarded from react-core BodhiProvider):

- basePath?: string (default: '/')
- callbackPath?: string (auto-computed from basePath + '/callback')
- handleCallback?: boolean (default: true)
- modalHtmlPath?: string
- logLevel?: LogLevel (default: 'warn')
- setupModal?: SetupModalVariant (default: 'setup-modal-v2') — 'setup-modal-v2' (eager direct/LNA flow + cloud-signup fallback) or 'setup-modal' (legacy multi-step wizard, handles extension install)
- autoProbe?: boolean (default: true) — eager headless server probe on mount; if ready the app proceeds with no modal
- defaultHost?: string — probe target when no cached URL exists; falls back to DEFAULT_LOCAL_URL ('http://localhost:1135'). Probe precedence: cached localStorage URL → defaultHost → DEFAULT_LOCAL_URL

### useBodhi() returns (react-core/src/BodhiProvider.tsx:43-65)

- client: UIClient
- clientState: ClientContextState (status, mode, extensionId, url, server, error)
- auth: AuthState (status, user, accessToken, error, refreshToken, expiresAt, isTokenRefresh)
- setupState: SetupState ('ready' | 'loading' | 'loaded')
- isAuthLoading: boolean
- login(options?: LoginOptions): Promise<AuthState | void>
- logout(): Promise<void>
- showSetup(): Promise<void>
- hideSetup(): void
- isAuthenticated: boolean (auth.status === 'authenticated')
- canLogin: boolean (isReady && !isAuthLoading)
- isReady: boolean (clientState.status === 'ready'; in direct mode also requires server.status not 'not-reachable'/'not-connected')
- isServerReady: boolean (clientState.server.status === 'ready')
- isOverallReady: boolean (isReady && isServerReady)
- isInitializing: boolean (clientState.status === 'initializing')
- isExtension: boolean (clientState.mode === 'extension')
- isDirect: boolean (clientState.mode === 'direct')

### Client namespaced API (core/src/openai-client-compat.ts)

- client.chat.completions.create({ model, messages, stream: true }) → AsyncGenerator<CreateChatCompletionStreamResponse>
- client.chat.completions.create({ model, messages, stream?: false }) → Promise<CreateChatCompletionResponse>
- client.models.list() → AsyncGenerator<Model>
- client.models.retrieve(modelId) → Promise<Model>
- client.embeddings.create({ model, input }) → Promise<CreateEmbeddingResponse>
- client.mcps.list() → Promise<ListMcpsResponse>
  > Note: Each Mcp has a `path` field (e.g. `/bodhi/v1/apps/mcps/{id}/mcp`). Use `createMcpClient(client, mcp.path)` for tool discovery and execution via @modelcontextprotocol/sdk.

### Generic API (core/src/interface.ts)

- sendApiRequest<TReq, TRes>(method, endpoint, body?, headers?, authenticated?) → Promise<ApiResponse<TRes>> (throws BodhiError on operational errors)
- stream<TReq, TRes>(method, endpoint, body?, headers?, authenticated?) → AsyncGenerator<TRes>
- pingApi() → Promise<ApiResponse<PingResponse>>
- getServerState() → Promise<BackendServerState>

### Auth methods (core/src/interface.ts)

- login(options?: LoginOptions) → Promise<AuthState>
  > LoginOptions: { role?, llms?, mcps?, reauthorize?, extraScopes?, onProgress? }. The SDK composes a
  > scope string (role token + scope_apps:llms/mcps flags + extraScopes passthrough) and top-level
  > navigates to ${serverUrl}/ui/apps/auth/ with PKCE; the user grants access on the consent page.
  > `reauthorize: true` re-runs consent while authenticated with prefill from the current grant
  > (via the token's access_request_id claim → source_access_request_id); approval replaces stored
  > tokens, prior grants stay live. Default/false short-circuits an authenticated session.
  > LoginProgressStage = 'reviewing' | 'authenticating' ('authenticating' only fires in the
  > extension/chrome.identity flow).
- logout() → Promise<AuthState>
- getAuthState() → Promise<AuthState>

### UIClient facade methods (core/src/interface.ts)

- setConnectionMode(mode: 'direct' | 'extension') → Promise<ClientState>
- getConnectionMode() → ConnectionMode | null
- testExtensionConnectivity(timeoutMs?) → Promise<ExtensionState>
- testDirectConnectivity(serverUrl?) → Promise<DirectState>
- getExtensionState() → Promise<ExtensionState>
- getDirectState() → Promise<DirectState>
- sendExtRequest(action, params) — extension mode only, throws otherwise
- createMcpTransportConfig(mcp_path) → McpTransportConfig (url, fetch)
- streamText(method, endpoint, body?, headers?, auth?) → { status, headers, body: AsyncGenerator<string> }
- debug() → Promise<Record<string, unknown>> — async introspection
- serialize() — for persistence
- setStateCallback(cb) — state change notifications

### IWebUIClient (web only, via isWebUIClient() guard)

- handleOAuthCallback(code, state) → Promise<AuthState>

### State types

- ClientState = ExtensionState | DirectState (core/src/types/client-state.ts)
- AuthState: { status, user, accessToken, error, refreshToken, expiresAt, isTokenRefresh } (core/src/types/auth.ts)
- BackendServerState: { status, version, error, deployment?, client_id? }
- ApiResponse<T> = { body: T, status: number, headers?: Record<string, string> }
- Error classes: BodhiError (operational), BodhiApiError extends BodhiError (HTTP 4xx/5xx) — use instanceof
- Utilities: unwrapResponse(response) returns body or throws BodhiApiError
- Type guards: isAuthenticated, isWebUIClient

### BodhiBadge component (react-core/src/BodhiBadge.tsx)

## BodhiApp Server Context (Light)

- Default: http://localhost:1135
- OpenAI-compatible: /v1/chat/completions (streaming SSE), /v1/models, /v1/embeddings
- Bodhi-specific: /bodhi/v1/apps/mcps/\* (MCP tool discovery/execution for external apps), /bodhi/v1/info
- Server states: ready, setup, resource_admin, not-reachable
- Deployment: standalone (default) vs multi_tenant
- Auth: OAuth 2.1 + PKCE, API tokens

## Authentication

- Dev: https://main-id.getbodhi.app/realms/bodhi (localhost allowed)
- Prod: https://id.getbodhi.app/realms/bodhi (real domains only)
- Register: https://developer.getbodhi.app
- Auto-callback: BodhiProvider handles OAuth redirect automatically

## Connection Modes

- Direct mode: HTTP to localhost via LNA (Chrome 130+ / Edge 143+). Default web path; what setup-modal-v2 configures.
- Extension mode: via Bodhi Browser extension (window.bodhiext). Used by \*-ext packages and browsers without LNA.
- Default setup-modal-v2 is direct-only (no extension-install guidance); legacy setup-modal handles extension install.

## Key Patterns

- Streaming: AsyncGenerator with `for await (const chunk of stream)`
- Error handling: `instanceof BodhiError` / `instanceof BodhiApiError` — no isApiResult\* type guards
- Conditional rendering: isOverallReady -> isAuthenticated -> app content
- GitHub Pages: basePath in Vite config + BodhiProvider, 404.html hack for SPA routing
- Multi-tenant: server returns deployment mode in BackendServerState
- MCP tool namespacing in agentic chat: `mcp__{slug}__{toolName}` format for tool names passed to LLM
- State persistence: use `client.serialize()` + `setStateCallback(cb)` for CLI-style apps
- Ext2ext: use `client.sendExtRequest(action, params)` only when `isExtension` is true

## MCP Integration

- client.mcps.list() → Promise<ListMcpsResponse> — GET /bodhi/v1/apps/mcps
  > Each Mcp has a `path` field (e.g. `/bodhi/v1/apps/mcps/{id}/mcp`). Use `createMcpClient(client, mcp.path)` for tool discovery and execution.
- createMcpClient(client, mcp.path) → Promise<Client> — creates connected @modelcontextprotocol/sdk Client
  > Available from `@bodhiapp/bodhi-js-react/mcp`, `@bodhiapp/bodhi-js-react-ext/mcp`, `@bodhiapp/bodhi-js-cli/mcp`
  > Works with any client type (UIClient, CliClient) — the client implements McpTransportProvider
- client.createMcpTransportConfig(mcp_path) → McpTransportConfig — low-level transport config for manual MCP SDK setup
- @modelcontextprotocol/sdk is an optional peer dependency (only needed when using createMcpClient)

### CLI MCP Usage (@bodhiapp/bodhi-js-cli)

```typescript
import { CliClient } from '@bodhiapp/bodhi-js-cli';
import { createMcpClient } from '@bodhiapp/bodhi-js-cli/mcp';

const client = new CliClient({ authClientId, authServerUrl, serverUrl });
await client.login({
  mcps: true,
  onAuthUrl: url => console.log(url),
});

const mcps = await client.mcps.list();
for (const mcp of mcps.mcps) {
  const mcpClient = await createMcpClient(client, mcp.path);
  const tools = await mcpClient.listTools();
  const result = await mcpClient.callTool({ name: 'search', arguments: { query: 'AI news' } });
  await mcpClient.close();
}
```

## Key Source Directories

- bodhi-js-sdk/docs/ (20+ comprehensive guide files)
- bodhi-js-sdk/core/src/interface.ts (UIClient interface)
- bodhi-js-sdk/core/src/openai-client-compat.ts (Chat, Models, Embeddings, Mcps list only)
- bodhi-js-sdk/core/src/mcp.ts (createMcpClient factory, McpTransportProvider interface)
- bodhi-js-sdk/cli/src/cli-client.ts (CliClient with createMcpTransportConfig)
- bodhi-js-sdk/core/src/direct-client.ts (DirectClient — headless, instantiable DirectClientBase for DedicatedWorker/server/test; token injection via initialTokens + InMemoryStorage, login() throws, direct-mode Bearer-injecting MCP transport)
- bodhi-js-sdk/core/src/login-options.ts (LoginOptionsBuilder)
- bodhi-js-sdk/core/src/login-flow.ts (performConsentLogin), core/src/oauth-callback.ts (deny/error classification)
- bodhi-js-sdk/core/src/types/ (ClientState, AuthState, LoginOptions)
- bodhi-js-sdk/react-core/src/BodhiProvider.tsx (React provider; mounts setupModal variant, default 'setup-modal-v2')
- bodhi-js-sdk/react-core/src/SetupModalV2Processor.tsx (default modal: auto-probe, defaultHost, cache, direct/LNA flow)
- bodhi-js-sdk/core/src/onboarding/modal-v2.ts (OnboardingModalV2 iframe lifecycle)
- bodhi-js-sdk/react-core/src/client-ctx.ts (useBodhi context)
- sdk-test-app/web/src/ (reference app using full SDK)
- Per-package CLAUDE.md files (core, web, ext, react-core, react, react-ext)
