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

## Public API Surface (VERIFIED from source code)

### BodhiProvider props (react/src/BodhiProvider.tsx)

- authClientId?: string — for auto-creation of WebUIClient
- clientConfig?: WebUIClientParams — optional config (authServerUrl, redirectUri, basePath, logLevel)
- client?: UIClient — custom client override (skips auto-creation)
- basePath?: string (default: '/')
- callbackPath?: string (auto-computed from basePath + '/callback')
- handleCallback?: boolean (default: true)
- modalHtmlPath?: string
- logLevel?: LogLevel (default: 'warn')

### useBodhi() returns (react-core/src/BodhiProvider.tsx:43-65)

- client: UIClient
- clientState: ClientContextState (status, mode, extensionId, url, server, error)
- auth: AuthState (status, user, accessToken, error)
- setupState: SetupState ('ready' | 'loading' | 'loaded')
- isAuthLoading: boolean
- login(options?: LoginOptions): Promise<AuthState | void>
- logout(): Promise<void>
- showSetup(): Promise<void>
- hideSetup(): void
- isAuthenticated: boolean (auth.status === 'authenticated')
- canLogin: boolean (isReady && !isAuthLoading)
- isReady: boolean (clientState.status === 'ready')
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
- client.mcps.listTools(mcpId) → Promise<McpToolsResponse>
- client.mcps.refreshTools(mcpId) → Promise<McpToolsResponse>
- client.mcps.executeTool(mcpId, toolName, params) → Promise<unknown>

### Generic API (core/src/interface.ts)

- sendApiRequest<TReq, TRes>(method, endpoint, body?, headers?, authenticated?) → Promise<ApiResponse<TRes>> (throws BodhiError on operational errors)
- stream<TReq, TRes>(method, endpoint, body?, headers?, authenticated?) → AsyncGenerator<TRes>
- pingApi() → Promise<ApiResponse<PingResponse>>
- getServerState() → Promise<BackendServerState>

### Auth methods (core/src/interface.ts)

- login(options?: LoginOptions) → Promise<AuthState>
- logout() → Promise<AuthState>
- getAuthState() → Promise<AuthState>
- requestAccess(body: CreateAccessRequest) → Promise<ApiResponse<CreateAccessRequestResponse>>
- getAccessRequestStatus(requestId) → Promise<ApiResponse<AccessRequestStatusResponse>>
- pollAccessRequestStatus(requestId, options?) → Promise<AccessRequestStatusResponse>

### UIClient facade methods (core/src/interface.ts)

- setConnectionMode(mode: 'direct' | 'extension') → Promise<ClientState>
- getConnectionMode() → ConnectionMode | null
- testExtensionConnectivity(timeoutMs?) → Promise<ExtensionState>
- testDirectConnectivity(serverUrl?) → Promise<DirectState>
- getExtensionState() → Promise<ExtensionState>
- getDirectState() → Promise<DirectState>

### IWebUIClient (web only, via isWebUIClient() guard)

- handleOAuthCallback(code, state) → Promise<AuthState>
- handleAccessRequestCallback(requestId) → Promise<AuthState>

### State types

- ClientState = ExtensionState | DirectState (core/src/types/client-state.ts)
- AuthState: { status, user, accessToken, error } (core/src/types/auth.ts)
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

- Extension mode: via Bodhi Browser extension (recommended)
- Direct mode: via LNA to localhost (experimental, Chrome 130+)
- SDK auto-detects; setup wizard guides installation

## Key Patterns

- Streaming: AsyncGenerator with `for await (const chunk of stream)`
- Error handling: type guards (isApiResultSuccess, isApiResultOperationError)
- Conditional rendering: isOverallReady -> isAuthenticated -> app content
- GitHub Pages: basePath in Vite config + BodhiProvider, 404.html hack for SPA routing
- Multi-tenant: server returns deployment mode in BackendServerState

## MCP Integration (VERIFIED: core/src/openai-client-compat.ts:227-299)

- client.mcps.list() → Promise<ListMcpsResponse> — GET /bodhi/v1/apps/mcps
- client.mcps.listTools(mcpId) → Promise<McpToolsResponse> — GET /bodhi/v1/apps/mcps/{id}/tools
- client.mcps.refreshTools(mcpId) → Promise<McpToolsResponse> — POST /bodhi/v1/apps/mcps/{id}/tools/refresh
- client.mcps.executeTool(mcpId, toolName, params) → Promise<unknown> — POST /bodhi/v1/apps/mcps/{id}/tools/{name}/execute

## Key Source Directories

- bodhi-js-sdk/docs/ (20+ comprehensive guide files)
- bodhi-js-sdk/core/src/interface.ts (UIClient interface)
- bodhi-js-sdk/core/src/openai-client-compat.ts (Chat, Models, Embeddings, Mcps)
- bodhi-js-sdk/core/src/access-request.ts (AccessRequestBuilder, LoginOptionsBuilder)
- bodhi-js-sdk/core/src/types/ (ClientState, AuthState, LoginOptions)
- bodhi-js-sdk/react-core/src/BodhiProvider.tsx (React provider)
- bodhi-js-sdk/react-core/src/client-ctx.ts (useBodhi context)
- sdk-test-app/web/src/ (reference app using full SDK)
- Per-package CLAUDE.md files (core, web, ext, react-core, react, react-ext)
