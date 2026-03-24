import type {
  AccessRequestStatusResponse,
  CreateAccessRequest,
  CreateAccessRequestResponse,
  PingResponse,
} from '@bodhiapp/ts-client';
import type { ApiResponse } from '@bodhiapp/bodhi-browser-types';
import type {
  AuthState,
  BackendServerState,
  ClientState,
  ConnectionMode,
  DirectState,
  ExtensionState,
  InitParams,
  LoginOptions,
  StateChangeCallback,
} from './types';
import type { Chat, Models, Embeddings, Toolsets, Mcps } from './openai-client-compat';

/**
 * ConnectionClient - Base interface for all client implementations
 *
 * Defines common interface for:
 * - IExtensionClient (chrome.runtime or window.bodhiext)
 * - DirectClient (direct HTTP fetch)
 *
 * Includes both connection methods (API calls, streaming) and auth methods.
 *
 * @template IParams - The init params type for this client
 * @template SerialState - The serialized state type for persistence
 */
export interface IConnectionClient<IParams = unknown, SerialState = unknown> {
  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize client discovery/connectivity
   * - IExtensionClient: Discover bodhi-browser-ext extension
   * - DirectClient: Test HTTP connectivity to server
   *
   * @param params - ExtParams or DirectParams (discriminated by serverUrl presence)
   * @returns ClientState (ExtensionState or DirectState based on active connection mode)
   */
  init(params: IParams): Promise<ClientState>;

  /**
   * Get current client state
   * @returns ClientState with status and connectionMode
   */
  getState(): ClientState;

  /**
   * Check if client is initialized (has handle/url configured)
   * - DirectClient: serverUrl is set
   * - ExtensionClient: extension is 'ready'
   * @returns true if client is ready to make requests
   */
  isClientInitialized(): boolean;

  /**
   * Check if backend server is ready (status === 'ready')
   * @returns true if server is connected and ready
   */
  isServerReady(): boolean;

  // ============================================================================
  // API Communication
  // ============================================================================

  /**
   * Send API request to local server
   * @param authenticated - If true, injects access token automatically
   * @returns ApiResponse with body and status
   * @throws BodhiError on operational errors (network, timeout, not initialized)
   */
  sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponse<TRes>>;

  /**
   * Ping API endpoint
   * @returns ApiResponse with ping response
   * @throws BodhiError on operational errors
   */
  pingApi(): Promise<ApiResponse<PingResponse>>;

  /**
   * Get backend server state
   * Calls /bodhi/v1/info and returns structured server state
   * @returns BackendServerState with status and version
   */
  getServerState(): Promise<BackendServerState>;

  // ============================================================================
  // Streaming
  // ============================================================================

  /**
   * Generic streaming request
   * - IExtensionClient: chrome.runtime.connect port or window.bodhiext stream
   * - DirectClient: Server-Sent Events (SSE) via fetch
   *
   * @returns AsyncGenerator yielding response chunks
   */
  stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): AsyncGenerator<TRes>;

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Login via OAuth
   * - IExtensionClient: Delegates to extension (chrome.identity or browser redirect)
   * - DirectClient: Direct HTTP OAuth flow
   * @param options - Optional login options (toolsetScopeIds, version)
   * @returns AuthState with login state and user info
   */
  login(options?: LoginOptions): Promise<AuthState>;

  /**
   * Logout and revoke tokens
   * @returns AuthState with logged out state
   */
  logout(): Promise<AuthState>;

  /**
   * Get current authentication state
   * @returns AuthState (discriminated union: AuthLoggedIn | AuthLoggedOut)
   */
  getAuthState(): Promise<AuthState>;

  /**
   * Request access for this app (draft → review flow)
   * POST /bodhi/v1/apps/request-access
   * @throws BodhiError on operational errors
   */
  requestAccess(body: CreateAccessRequest): Promise<ApiResponse<CreateAccessRequestResponse>>;

  /**
   * Get status of an access request
   * GET /bodhi/v1/apps/access-requests/{id}?app_client_id=xxx
   * @throws BodhiError on operational errors
   */
  getAccessRequestStatus(requestId: string): Promise<ApiResponse<AccessRequestStatusResponse>>;

  /**
   * Poll access request until approved/denied/failed/expired
   */
  pollAccessRequestStatus(
    requestId: string,
    options?: { intervalMs?: number; timeoutMs?: number }
  ): Promise<AccessRequestStatusResponse>;

  /**
   * Set or update the state change callback
   * Allows setting callback after construction (for React dependency injection)
   * @param callback - Callback invoked on client state or auth state changes
   */
  setStateCallback(callback: StateChangeCallback): void;

  /**
   * Serialize client state for persistence
   * @returns Serialized state suitable for localStorage/chrome.storage
   */
  serialize(): SerialState;

  /**
   * Debug dump of client internal state
   * Returns free-form object for console.log or UI display
   * Includes transient state (unlike serialize which is for persistence)
   * Fetches live authState via async call
   * @returns Promise resolving to object with internal state for debugging
   */
  debug(): Promise<Record<string, unknown>>;

  // ============================================================================
  // OpenAI-Compatible Namespaced API
  // ============================================================================

  /**
   * Chat completions resource
   * Usage: client.chat.completions.create({ model, messages, stream })
   */
  readonly chat: Chat;

  /**
   * Models resource
   * Usage: for await (const model of client.models.list()) {...}
   */
  readonly models: Models;

  /**
   * Embeddings resource
   * Usage: await client.embeddings.create({ model, input })
   */
  readonly embeddings: Embeddings;

  /**
   * Toolsets resource
   * Usage: await client.toolsets.list()
   */
  readonly toolsets: Toolsets;

  /**
   * MCPs resource
   * Usage: await client.mcps.list()
   */
  readonly mcps: Mcps;
}

/**
 * IExtensionClient - Extension-specific client interface
 *
 * Extends IConnectionClient with sendExtRequest for direct extension communication.
 *
 * Implementations:
 * - Ext2ExtClient: chrome.runtime.sendMessage (extension context)
 * - Web2ExtClient: window.bodhiext (web page context)
 *
 * @template IParams - The init params type for this client
 * @template SerialState - The serialized state type for persistence
 */
export interface IExtensionClient<IParams = unknown, SerialState = unknown>
  extends IConnectionClient<IParams, SerialState> {
  /**
   * Send extension request
   * Communicates with bodhi-browser-ext extension via:
   * - chrome.runtime.sendMessage (extension context)
   * - window.bodhiext (web context)
   *
   * @param action - Extension action (e.g., 'DISCOVER_EXTENSION', 'LOGIN')
   * @param params - Action parameters
   * @returns Response from extension
   */
  sendExtRequest<TParams = void, TRes = unknown>(action: string, params?: TParams): Promise<TRes>;
}

/**
 * DirectClient - Direct HTTP client interface
 *
 * Extends IConnectionClient with no additional methods.
 * Communicates directly with local server via HTTP fetch (no extension intermediary).
 *
 * @template IParams - The init params type for this client
 * @template SerialState - The serialized state type for persistence
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IDirectClient<IParams = unknown, SerialState = unknown>
  extends IConnectionClient<IParams, SerialState> {}

/**
 * UIClient - Facade client with connection mode switching
 *
 * Combination of ConnectionClient + connection mode management.
 * Internally holds both IExtensionClient and DirectClient, delegates to active client.
 *
 * Usage:
 * ```
 * const uiClient: UIClient = new UIClientImpl(extensionClient);
 * await uiClient.init({ serverUrl: 'http://localhost:1135' }); // Init direct
 * uiClient.setConnectionMode('extension'); // Switch to extension mode
 * ```
 */
export type UIClient = IConnectionClient<InitParams> & {
  /**
   * Set connection mode and switch active client
   * @param mode - 'direct' or 'extension'
   * @returns Promise with connection mode result
   */
  setConnectionMode(mode: ConnectionMode): Promise<ClientState>;

  /**
   * Get current connection mode
   * @returns 'direct', 'extension', or null if not set
   */
  getConnectionMode(): ConnectionMode | null;

  /**
   * Test extension connectivity regardless of current connection mode
   * Initializes extension client and tests backend server connection
   * @param timeoutMs - Optional timeout for extension discovery
   * @returns ExtensionState with extension status and server state
   */
  testExtensionConnectivity(timeoutMs?: number): Promise<ExtensionState>;

  /**
   * Test direct server connectivity
   * Initializes direct client and tests backend server connection
   * @param serverUrl - Optional server URL to test. If not provided, uses saved serverUrl from state
   * @returns DirectState with server status and URL
   */
  testDirectConnectivity(serverUrl?: string): Promise<DirectState>;

  /**
   * Get current extension state (regardless of current connection mode)
   * Returns extension status and backend server state
   * @returns ExtensionState
   */
  getExtensionState(): Promise<ExtensionState>;

  /**
   * Get current direct server state (if configured)
   * Returns direct server status and URL
   * @returns DirectState
   */
  getDirectState(): Promise<DirectState>;

  /**
   * Send extension request (only available in extension mode)
   * @param action - Extension action
   * @param params - Action parameters
   * @returns Response from extension
   * @throws Error if connection mode is not 'extension'
   */
  sendExtRequest<TParams = void, TRes = unknown>(action: string, params?: TParams): Promise<TRes>;
};

/**
 * Web-specific UIClient interface with OAuth callback handling
 * Defines the contract for web mode clients
 */
export interface IWebUIClient extends UIClient {
  /**
   * Handle OAuth callback after redirect (web mode only)
   * @param code - Authorization code from OAuth provider
   * @param state - State parameter for CSRF protection
   * @returns AuthLoggedIn with login state and user info
   */
  handleOAuthCallback(code: string, state: string): Promise<AuthState>;

  /**
   * Handle access request callback after redirect review (web only)
   * Called when user returns from review_url redirect
   */
  handleAccessRequestCallback(requestId: string): Promise<AuthState>;
}

/**
 * Type guard to check if client has OAuth callback handling (web mode)
 * @param client - Client to check
 * @returns true if client is IWebUIClient with handleOAuthCallback method
 */
export function isWebUIClient(client: UIClient): client is IWebUIClient {
  return 'handleOAuthCallback' in client;
}
