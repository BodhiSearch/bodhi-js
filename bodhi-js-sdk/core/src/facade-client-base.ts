/**
 * BaseFacadeClient - Abstract base class for facade clients
 *
 * Provides common implementation for ExtUIClient and WebUIClient facades.
 * Both facades delegate to internal clients (extension-based or direct HTTP)
 * based on user's connection mode preference.
 *
 * Subclasses must implement factory methods to create their specific internal clients.
 */

import type {
  AccessRequestStatusResponse,
  CreateAccessRequest,
  CreateAccessRequestResponse,
} from '@bodhiapp/ts-client';
import type { IConnectionClient, IExtensionClient } from './interface';
import { Logger } from './logger';
import { BodhiClientUserPrefsManager } from './storage';
import { Chat, Models, Embeddings, Toolsets, Mcps } from './openai-client-compat';
import type {
  ApiResponseResult,
  AuthState,
  BackendServerState,
  ClientState,
  ConnectionMode,
  DirectState,
  ExtensionState,
  InitParams,
  LoginOptions,
  SerializedClientState,
  SerializedDirectState,
  SerializedExtensionState,
  StateChange,
  StateChangeCallback,
} from './types';
import { isDirectState, isExtensionState, NOOP_STATE_CALLBACK, SERVER_ERROR_CODES } from './types';

/**
 * Base facade client with common delegation logic
 *
 * @template TConfig - Configuration type for this facade
 * @template TExtClient - Extension client type (implements IConnectionClient with SerializedExtensionState)
 * @template TDirectClient - Direct client type (implements IConnectionClient with SerializedDirectState)
 */
export abstract class BaseFacadeClient<
  TConfig,
  TExtClient extends IExtensionClient<unknown, SerializedExtensionState>,
  TDirectClient extends IConnectionClient<unknown, SerializedDirectState>,
> {
  protected logger: Logger;
  protected extClient: TExtClient;
  protected directClient: TDirectClient;
  protected prefs: BodhiClientUserPrefsManager;
  protected connectionMode: ConnectionMode | null = null;
  protected authClientId: string;
  protected config: TConfig;
  protected onStateChange: StateChangeCallback;

  // OpenAI-compatible resource namespaces
  private _chat: Chat | undefined;
  private _models: Models | undefined;
  private _embeddings: Embeddings | undefined;
  private _toolsets: Toolsets | undefined;
  private _mcps: Mcps | undefined;

  constructor(authClientId: string, config: TConfig, onStateChange?: StateChangeCallback) {
    this.authClientId = authClientId;
    this.config = config;
    this.onStateChange = onStateChange ?? NOOP_STATE_CALLBACK;

    // Get logger - subclass extracts logLevel from config
    this.logger = this.createLogger(config);

    // Get storage prefix - subclass extracts basePath and storagePrefix from config
    const effectivePrefix = this.createStoragePrefix(config);
    this.prefs = new BodhiClientUserPrefsManager(effectivePrefix);

    // Call abstract factories to create internal clients
    this.extClient = this.createExtClient(config, (change) =>
      this.handleInternalStateChange(change)
    );
    this.directClient = this.createDirectClient(authClientId, config, (change) =>
      this.handleInternalStateChange(change)
    );
  }

  // ============================================================================
  // Abstract Factory Methods (implemented by subclasses)
  // ============================================================================

  /**
   * Create logger instance
   * Subclasses extract logLevel from their specific config type
   */
  protected abstract createLogger(config: TConfig): Logger;

  /**
   * Create storage prefix from config
   * Subclasses extract basePath and storagePrefix from their specific config type
   */
  protected abstract createStoragePrefix(config: TConfig): string;

  /**
   * Create extension-based client (ExtClient or WindowBodhiextClient)
   */
  protected abstract createExtClient(
    config: TConfig,
    onStateChange: (change: StateChange) => void
  ): TExtClient;

  /**
   * Create direct HTTP client (DirectExtClient or DirectWebClient)
   */
  protected abstract createDirectClient(
    authClientId: string,
    config: TConfig,
    onStateChange: (change: StateChange) => void
  ): TDirectClient;

  // ============================================================================
  // State Change Handling (Private)
  // ============================================================================

  /**
   * Notify client state change by calling facade's callback with discriminated union
   */
  private notifyStateChange(): void {
    this.persist();
    this.onStateChange({ type: 'client-state', state: this.getState() });
    this.getAuthState()
      .then((authState) => {
        this.onStateChange({ type: 'auth-state', state: authState });
      })
      .catch((err) => {
        this.logger.error('Failed to get auth state after client-state change:', err);
      });
  }

  /**
   * Handle state changes from internal clients (extClient or directClient)
   * For client state changes, notifyStateChange that persists and notifies
   * For auth state changes, notify the callback directly
   */
  private handleInternalStateChange(change: StateChange): void {
    if (change.type === 'client-state') {
      this.notifyStateChange();
    } else if (change.type === 'auth-state') {
      this.getAuthState()
        .then((authState) => {
          this.onStateChange({ type: 'auth-state', state: authState });
        })
        .catch((err) => {
          this.logger.error('Failed to get auth state after client-state change:', err);
        });
    }
  }

  // ============================================================================
  // Persistence (Public Methods)
  // ============================================================================

  /**
   * Serialize current state for persistence
   * Returns SerializedClientState with nested client states
   */
  serialize(): SerializedClientState {
    return {
      connectionMode: this.connectionMode,
      direct: this.directClient.serialize(),
      extension: this.extClient.serialize(),
    };
  }

  /**
   * Debug dump of facade client internal state
   * Aggregates debug info from both internal clients
   */
  async debug(): Promise<Record<string, unknown>> {
    return {
      type: 'FacadeClient',
      connectionMode: this.connectionMode,
      authClientId: this.authClientId,
      config: this.config,
      extClient: await this.extClient.debug(),
      directClient: await this.directClient.debug(),
    };
  }

  /**
   * Persist current state to storage
   */
  persist(): void {
    const serialized = this.serialize();
    this.prefs.setSerializedClientState(serialized);
    this.logger.debug('Persisted state:', JSON.stringify(serialized, null, 2));
  }

  /**
   * Set or update the state change callback
   */
  setStateCallback(callback: StateChangeCallback): void {
    this.onStateChange = callback;
    // Internal clients already have handleInternalStateChange set in constructor
    // No need to propagate callback to internal clients
  }

  // ============================================================================
  // Connection Mode Helper
  // ============================================================================

  /**
   * Check if connection mode is null or direct
   * Used for delegation - prefers direct on fresh install
   */
  protected isNotSetOrDirect(): boolean {
    return this.connectionMode == null || this.connectionMode === 'direct';
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize client based on current connectionMode
   *
   * State Management:
   * - Facade owns persistence via prefs - savedState param is NOT used
   * - Restores connectionMode and internal client states from prefs.getSerializedClientState()
   * - On fresh install (no saved state), defaults to connectionMode: null
   *
   * InitParams (optional):
   * - serverUrl: Direct mode server URL (overrides saved state)
   * - testConnection: Test server connectivity during init
   * - timeoutMs: Extension mode discovery timeout
   * - selectedConnection, savedState: Internal use only (not for external callers)
   *
   * Eager Connection Detection (when connectionMode is null):
   * Tries direct first, then extension, auto-selecting first one with server ready
   */
  async init(params: InitParams = {}): Promise<ExtensionState | DirectState> {
    // Restore state from prefs (facade owns persistence, params.savedState not used)
    const savedState = this.prefs.getSerializedClientState<SerializedClientState>() ?? {
      connectionMode: null,
      direct: {},
      extension: {},
    };

    // Restore connectionMode from saved state if not already set
    if (this.connectionMode === null && savedState.connectionMode) {
      this.connectionMode = savedState.connectionMode;
      this.logger.info('Restored connectionMode from storage:', savedState.connectionMode);
    }

    // ==== Eager connection detection when connectionMode is null ====
    if (this.connectionMode === null) {
      this.logger.info('{connectionMode: null} - Eager connection detection');
      // Try direct connection first (preferred for lower latency)
      await this.directClient.init({
        savedState: savedState.direct,
        selectedConnection: true,
        testConnection: true,
        serverUrl: params.serverUrl,
      });

      if (this.directClient.isServerReady()) {
        this.connectionMode = 'direct';
        this.logger.info('Auto-detected direct connection (server ready)');
      }

      // Try extension if direct not ready
      if (this.connectionMode === null) {
        await this.extClient.init({
          savedState: savedState.extension,
          selectedConnection: true,
          testConnection: true,
          timeoutMs: params.timeoutMs,
        });

        if (this.extClient.isServerReady()) {
          this.connectionMode = 'extension';
          this.logger.info('Auto-detected extension connection (server ready)');
        }
      } else {
        // Direct succeeded - still init extension but minimal (no discovery/test)
        await this.extClient.init({
          savedState: savedState.extension,
          selectedConnection: false,
          testConnection: false,
        });
      }
      this.notifyStateChange();
      return this.getState();
    }

    // ==== When connectionMode is set ====
    const directSelected = this.connectionMode === 'direct';
    const extSelected = this.connectionMode === 'extension';

    await this.extClient.init({
      savedState: savedState.extension,
      selectedConnection: extSelected,
      testConnection: extSelected && params.testConnection,
      timeoutMs: params.timeoutMs,
    });

    await this.directClient.init({
      savedState: savedState.direct,
      selectedConnection: directSelected,
      testConnection: directSelected && params.testConnection,
      serverUrl: params.serverUrl,
    });

    this.notifyStateChange();

    // ASYNC SERVER STATE REFRESH: When connectionMode is set and not explicitly testing
    // Fire-and-forget init with testConnection: true to get server state async
    if (!params.testConnection && this.isClientInitialized() && !this.isServerReady()) {
      this.logger.info('Triggering async server state refresh');
      const activeClient = this.isNotSetOrDirect() ? this.directClient : this.extClient;
      activeClient.init({ testConnection: true, selectedConnection: true }).catch((err) => {
        this.logger.warn('Async server state refresh failed:', err);
      }); // no await so non-blocking return
      // State change will be notified via internal client callback → handleInternalStateChange
    }

    return this.getState();
  }

  getState(): ClientState {
    if (this.isNotSetOrDirect()) {
      return this.directClient.getState();
    }
    return this.extClient.getState();
  }

  isClientInitialized(): boolean {
    if (this.isNotSetOrDirect()) {
      return this.directClient.isClientInitialized();
    }
    return this.extClient.isClientInitialized();
  }

  isServerReady(): boolean {
    if (this.isNotSetOrDirect()) {
      return this.directClient.isServerReady();
    }
    return this.extClient.isServerReady();
  }

  // ============================================================================
  // Extension Communication
  // ============================================================================

  sendExtRequest<TParams = void, TRes = unknown>(action: string, params?: TParams): Promise<TRes> {
    if (this.isNotSetOrDirect()) {
      throw new Error('sendExtRequest not available on direct connection');
    }
    return this.extClient.sendExtRequest(action, params);
  }

  // ============================================================================
  // API Communication
  // ============================================================================

  sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponseResult<TRes>> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.sendApiRequest(method, endpoint, body, headers, authenticated);
    }
    return this.extClient.sendApiRequest(method, endpoint, body, headers, authenticated);
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  login(options?: LoginOptions): Promise<AuthState> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.login(options);
    }
    return this.extClient.login(options);
  }

  logout(): Promise<AuthState> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.logout();
    }
    return this.extClient.logout();
  }

  getAuthState(): Promise<AuthState> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.getAuthState();
    }
    return this.extClient.getAuthState();
  }

  requestAccess(
    body: CreateAccessRequest
  ): Promise<ApiResponseResult<CreateAccessRequestResponse>> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.requestAccess(body);
    }
    return this.extClient.requestAccess(body);
  }

  getAccessRequestStatus(
    requestId: string
  ): Promise<ApiResponseResult<AccessRequestStatusResponse>> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.getAccessRequestStatus(requestId);
    }
    return this.extClient.getAccessRequestStatus(requestId);
  }

  pollAccessRequestStatus(
    requestId: string,
    options?: { intervalMs?: number; timeoutMs?: number }
  ): Promise<AccessRequestStatusResponse> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.pollAccessRequestStatus(requestId, options);
    }
    return this.extClient.pollAccessRequestStatus(requestId, options);
  }

  // ============================================================================
  // API Convenience
  // ============================================================================

  pingApi(): Promise<ApiResponseResult<{ message: string }>> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.pingApi();
    }
    return this.extClient.pingApi();
  }

  async getServerState(): Promise<BackendServerState> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.getServerState();
    }
    return this.extClient.getServerState();
  }

  // ============================================================================
  // Streaming
  // ============================================================================

  stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): AsyncGenerator<TRes> {
    if (this.isNotSetOrDirect()) {
      return this.directClient.stream(method, endpoint, body, headers, authenticated);
    }
    return this.extClient.stream(method, endpoint, body, headers, authenticated);
  }

  // ============================================================================
  // OpenAI-Compatible Namespaced API
  // ============================================================================

  get chat(): Chat {
    return (this._chat ??= new Chat(this));
  }

  get models(): Models {
    return (this._models ??= new Models(this));
  }

  get embeddings(): Embeddings {
    return (this._embeddings ??= new Embeddings(this));
  }

  get toolsets(): Toolsets {
    return (this._toolsets ??= new Toolsets(this));
  }

  get mcps(): Mcps {
    return (this._mcps ??= new Mcps(this));
  }

  // ============================================================================
  // Connection Mode (Facade-specific)
  // ============================================================================

  getConnectionMode(): ConnectionMode | null {
    return this.connectionMode;
  }

  async setConnectionMode(mode: ConnectionMode): Promise<ClientState> {
    this.logger.info('Switching connection mode to:', mode);

    // Unified validation: allow if initialized, don't require server ready
    if (mode === 'direct') {
      if (!this.directClient.isClientInitialized()) {
        throw new Error(SERVER_ERROR_CODES.SERVER_NOT_READY.message);
      }
    } else if (mode === 'extension') {
      if (!this.extClient.isClientInitialized()) {
        throw new Error(SERVER_ERROR_CODES.SERVER_NOT_READY.message);
      }
    } else {
      throw new Error('Invalid connection mode');
    }

    this.connectionMode = mode;
    this.notifyStateChange();
    return this.getState();
  }

  // ============================================================================
  // Unified Connectivity Testing Methods
  // ============================================================================

  /**
   * Test extension connectivity regardless of current connection mode
   * Fresh connection test - injects testConnection: true internally
   * @param timeoutMs - Optional timeout for extension discovery
   */
  async testExtensionConnectivity(timeoutMs?: number): Promise<ExtensionState> {
    const extState = await this.extClient.init({
      testConnection: true,
      timeoutMs,
    });
    this.notifyStateChange();
    return extState as ExtensionState;
  }

  /**
   * Test direct server connectivity
   * Fresh connection test - injects testConnection: true internally
   * @param serverUrl - Optional server URL to test. If not provided, uses saved serverUrl from state
   */
  async testDirectConnectivity(serverUrl?: string): Promise<DirectState> {
    const url = serverUrl ?? this.directClient.serialize().url;
    if (!url) {
      return this.directClient.getState() as DirectState;
    }
    const directState = await this.directClient.init({
      serverUrl: url,
      testConnection: true,
    });
    this.notifyStateChange();
    return directState as DirectState;
  }

  /**
   * Get current extension state (regardless of current connection mode)
   */
  async getExtensionState(): Promise<ExtensionState> {
    const state = this.extClient.getState();
    if (isExtensionState(state)) {
      return state;
    }
    throw new Error('extClient did not return an ExtensionState');
  }

  /**
   * Get current direct server state
   */
  async getDirectState(): Promise<DirectState> {
    const state = this.directClient.getState();
    if (isDirectState(state)) {
      return state;
    }
    throw new Error('directClient did not return a DirectState');
  }
}
