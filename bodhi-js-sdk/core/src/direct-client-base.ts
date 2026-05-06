/**
 * DirectClientBase - Abstract base class for DirectClient implementations
 *
 * Contains common HTTP fetch and streaming logic shared between
 * DirectExtClient and DirectWebClient.
 */

export interface ConnectivityTestResult {
  success: boolean;
  serverInfo?: { status: string; version: string; deployment?: DeploymentMode; client_id?: string };
  error?: { message: string; type: string };
}

/**
 * Test connectivity to a local server
 * @param serverUrl - The server URL to test
 * @param timeoutMs - Optional timeout in milliseconds (default: DEFAULT_API_TIMEOUT_MS)
 * @returns Promise with connectivity test result
 */
export async function testServerConnectivity(
  serverUrl: string,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
): Promise<ConnectivityTestResult> {
  const url = `${serverUrl}/bodhi/v1/info`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok && response.status === 200) {
      const body = await response.json();
      return {
        success: true,
        serverInfo: {
          status: body.status || 'unknown',
          version: body.version || 'unknown',
          deployment: body.deployment,
          client_id: body.client_id,
        },
      };
    }

    // Try to parse error body as OpenAI API error format { error: { message, type, code?, param? } }
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message && errorBody?.error?.type) {
        return {
          success: false,
          error: errorBody.error,
        };
      }
    } catch {
      // JSON parse failed, fall through to generic error
    }

    return {
      success: false,
      error: {
        message: `Server returned ${response.status}: ${response.statusText}`,
        type: 'server-error',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    return {
      success: false,
      error: {
        message: `Cannot reach server: ${errorMessage}`,
        type: 'network-error',
      },
    };
  }
}

import type {
  AccessRequestStatusResponse,
  BodhiErrorResponse,
  CreateAccessRequest,
  CreateAccessRequestResponse,
  DeploymentMode,
  PingResponse,
} from '@bodhiapp/ts-client';
import type { ApiResponse } from '@bodhiapp/bodhi-browser-types';
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-browser-types';
import { DEFAULT_API_TIMEOUT_MS } from './constants';
import { pollAccessRequestUntilResolved } from './access-request';
import type { IDirectClient, StreamTextResult } from './interface';
import { Logger } from './logger';
import { Chat, Models, Embeddings, Mcps } from './openai-client-compat';
import {
  createOAuthEndpoints,
  extractUserInfo,
  refreshAccessToken,
  type OAuthEndpoints,
  type RefreshTokenResponse,
} from './oauth';
import { createStorageKeys, createStoragePrefixWithServerUrl, type StorageKeys } from './storage';
import {
  type AuthState,
  type BackendServerState,
  type ClientState,
  type DirectState,
  type IStorage,
  type InitialTokens,
  type InitParams,
  type LogLevel,
  type SerializedDirectState,
  type StateChangeCallback,
} from './types';
import {
  BACKEND_SERVER_NOT_CONNECTED,
  BACKEND_SERVER_NOT_REACHABLE,
  backendServerNotReady,
  DIRECT_STATE_NOT_INITIALIZED,
  NOOP_STATE_CALLBACK,
} from './types';

/**
 * Base configuration for DirectClient
 */
export interface DirectClientBaseConfig {
  authClientId: string;
  authServerUrl: string;
  storagePrefix: string;
  logLevel: LogLevel;
  loggerPrefix: string;
  apiTimeoutMs?: number;
  storage?: IStorage;
  initialTokens?: InitialTokens;
}

/**
 * DirectClientBase - Abstract base implementing common HTTP/streaming logic
 */
export abstract class DirectClientBase implements IDirectClient {
  protected logger: Logger;
  protected serverUrl: string | null = null;
  protected authClientId: string;
  protected authServerUrl: string;
  protected authEndpoints: OAuthEndpoints;
  protected storage: IStorage | null = null;
  /**
   * Base prefix for OAuth storage keys (pre-serverUrl scope).
   * Captured from config; combined with current serverUrl to build `storageKeys`.
   */
  private basePrefix: string;
  /**
   * OAuth storage keys scoped by (basePrefix, serverUrl). Rebuilt in `init()` whenever
   * serverUrl is committed — tokens are namespaced per server to avoid presenting
   * tokens issued by server A as though they were valid for server B.
   * Undefined until `serverUrl` is set; guard auth-path access with `this.serverUrl`.
   */
  protected storageKeys!: StorageKeys;
  protected state: DirectState = DIRECT_STATE_NOT_INITIALIZED;
  private onStateChange: StateChangeCallback;
  private refreshPromise: Promise<string | null> | null = null;
  private initPromise: Promise<DirectState> | null = null;
  private apiTimeoutMs: number;
  private initialTokens: InitialTokens | undefined;

  // OpenAI-compatible resource namespaces
  private _chat: Chat | undefined;
  private _models: Models | undefined;
  private _embeddings: Embeddings | undefined;
  private _mcps: Mcps | undefined;

  constructor(config: DirectClientBaseConfig, onStateChange?: StateChangeCallback) {
    this.logger = new Logger(config.loggerPrefix, config.logLevel);
    this.authClientId = config.authClientId;
    this.authServerUrl = config.authServerUrl;
    this.authEndpoints = createOAuthEndpoints(this.authServerUrl);
    this.basePrefix = config.storagePrefix;
    this.onStateChange = onStateChange ?? NOOP_STATE_CALLBACK;
    this.apiTimeoutMs = config.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
    this.storage = config.storage ?? null;
    this.initialTokens = config.initialTokens;
  }

  /**
   * Set client state and notify callback
   */
  protected setState(newState: DirectState): void {
    this.state = newState;
    this.onStateChange({ type: 'client-state', state: newState });
  }

  /**
   * Set auth state and notify callback
   */
  protected setAuthState(authState: AuthState): void {
    this.onStateChange({ type: 'auth-state', state: authState });
  }

  /**
   * Set or update the state change callback
   */
  setStateCallback(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async init(params: InitParams): Promise<DirectState> {
    // Priority: explicit serverUrl > savedState.url > this.serverUrl
    const serverUrl =
      params.serverUrl ?? (params.savedState as SerializedDirectState)?.url ?? this.serverUrl;

    // IDEMPOTENCY: If already initialized with same URL and not testing, skip
    if (this.serverUrl && this.serverUrl === serverUrl && !params.testConnection) {
      if (this.initPromise && params.selectedConnection) {
        this.logger.debug('Init in-flight for same URL, awaiting existing init');
        return this.initPromise;
      }
      this.logger.debug('Already initialized with serverUrl, skipping init');
      return this.state;
    }

    // Server URL changed mid-session: clear tokens issued by the previous server
    // before rebinding. Tokens are namespaced per server so the new URL's storage
    // starts empty, but we also actively purge the old namespace for security
    // (do not leave credentials behind for a server the user is no longer using).
    if (this.serverUrl && serverUrl && this.serverUrl !== serverUrl) {
      this.logger.info('serverUrl changed, clearing tokens from previous server');
      await this.clearPreviousServerTokens(this.serverUrl);
    }

    this.serverUrl = serverUrl;

    if (!this.serverUrl) {
      this.logger.info('No serverUrl provided, returning not-initialized state');
      return DIRECT_STATE_NOT_INITIALIZED;
    }

    // Rebuild OAuth storage keys under the new (basePrefix, serverUrl) namespace.
    this.rebuildStorageKeys();

    // Bootstrap auth from initial tokens (consumed once, not re-applied on re-init).
    // Runs after storageKeys is rebuilt so tokens land at serverUrl-scoped keys.
    if (this.initialTokens) {
      await this._bootstrapInitialTokens(this.initialTokens);
      this.initialTokens = undefined;
    }

    this.logger.info('Initializing with serverUrl:', this.serverUrl);
    // testConnection: true → initialize AND test server (regardless of selectedConnection)
    if (params.testConnection) {
      this.initPromise = (async () => {
        try {
          const connectivity = await this.testConnectivity();
          let serverState: BackendServerState;

          if (connectivity.success && connectivity.serverInfo) {
            const status = connectivity.serverInfo.status;
            const version = connectivity.serverInfo.version;

            if (status === 'ready') {
              serverState = {
                status: 'ready',
                version,
                error: null,
                deployment: connectivity.serverInfo.deployment ?? null,
                client_id: connectivity.serverInfo.client_id ?? null,
              };
            } else if (status === 'setup' || status === 'resource_admin' || status === 'error') {
              serverState = backendServerNotReady(
                status,
                version,
                undefined,
                connectivity.serverInfo.deployment,
                connectivity.serverInfo.client_id
              );
            } else {
              serverState = BACKEND_SERVER_NOT_REACHABLE;
            }
          } else {
            this.logger.warn('Connection failed:', connectivity.error);
            serverState = BACKEND_SERVER_NOT_REACHABLE;
          }

          this.setState({ type: 'direct', url: serverUrl!, server: serverState });
          this.logger.info('Initialized with testConnection, server state:', serverState.status);
          return this.state;
        } finally {
          this.initPromise = null;
        }
      })();
      return this.initPromise;
    }

    // testConnection: false, selectedConnection: false → not-initialized
    if (!params.selectedConnection) {
      this.logger.info('No selectedConnection, returning not-initialized state');
      return DIRECT_STATE_NOT_INITIALIZED;
    }

    // testConnection: false, selectedConnection: true → client ready, server not-initialized
    this.setState({ type: 'direct', url: serverUrl!, server: BACKEND_SERVER_NOT_CONNECTED });
    this.logger.info('Initialized with selectedConnection, server state: not-connected');
    return this.state;
  }

  getState(): ClientState {
    return this.state;
  }

  isClientInitialized(): boolean {
    return this.serverUrl !== null;
  }

  isServerReady(): boolean {
    return (
      this.isClientInitialized() &&
      this.state.type === 'direct' &&
      this.state.server.status === 'ready'
    );
  }

  /**
   * Ensures client is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.serverUrl) {
      throw new BodhiError(
        'not_initialized',
        'DirectClient not initialized. Call init(serverUrl) first.'
      );
    }
  }

  // ============================================================================
  // API Communication (Direct HTTP Fetch)
  // ============================================================================

  async sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): Promise<ApiResponse<TRes>> {
    if (!this.serverUrl) {
      throw new BodhiError('not_initialized', 'Client not initialized - connection failed');
    }
    const url = `${this.serverUrl}${endpoint}`;
    this.logger.debug(`${method} ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeoutMs);

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Inject Authorization header if authenticated
      if (authenticated) {
        const token = await this._getAccessTokenRaw();
        if (token) {
          fetchHeaders['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const data = await response.json();
      return {
        body: data as TRes,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Check if error is from abort controller timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BodhiError(
          'timeout_error',
          `[bodhi-js-sdk/direct] network timeout: api request not completed within configured/default timeout of ${this.apiTimeoutMs}ms`
        );
      }
      throw new BodhiError('network_error', `Network error: ${errorMessage}`);
    }
  }

  async pingApi(): Promise<ApiResponse<PingResponse>> {
    return this.sendApiRequest<void, PingResponse>('GET', '/ping', undefined, {}, false);
  }

  /**
   * Get backend server state
   * Calls /bodhi/v1/info and returns structured server state
   */
  async getServerState(): Promise<BackendServerState> {
    const result = await this.testConnectivity();

    if (!result.success) {
      return {
        status: 'not-reachable',
        version: null,
        error: result.error || { message: 'Connection failed', type: 'network_error' },
      };
    }

    const info = result.serverInfo!;
    const baseFields = { deployment: info.deployment ?? null, client_id: info.client_id ?? null };
    switch (info.status) {
      case 'ready':
        return { status: 'ready', version: info.version, error: null, ...baseFields };
      case 'setup':
        return {
          status: 'setup',
          version: info.version,
          error: { message: 'Setup required', type: 'extension_error' },
          ...baseFields,
        };
      case 'resource_admin':
        return {
          status: 'resource_admin',
          version: info.version,
          error: { message: 'Resource admin required', type: 'extension_error' },
          ...baseFields,
        };
      case 'error':
        return {
          status: 'error',
          version: info.version || 'unknown',
          error: { message: 'Server error', type: 'extension_error' },
          ...baseFields,
        };
      default:
        return {
          status: 'not-reachable',
          version: null,
          error: { message: 'Unknown status', type: 'extension_error' },
        };
    }
  }

  // ============================================================================
  // Streaming (Direct HTTP with SSE)
  // ============================================================================

  async *stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): AsyncGenerator<TRes> {
    if (!this.serverUrl) {
      throw new BodhiError('not_initialized', 'Client not initialized - connection failed');
    }
    const url = `${this.serverUrl}${endpoint}`;
    this.logger.debug(`Stream ${method} ${url}`);

    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...headers,
    };

    if (authenticated) {
      const token = await this._getAccessTokenRaw();
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BodhiError('network_error', `Network error: ${errorMessage}`);
    }

    if (!response.ok) {
      let errorBody: BodhiErrorResponse;
      try {
        errorBody = (await response.json()) as BodhiErrorResponse;
      } catch {
        errorBody = { error: { message: `HTTP ${response.status}`, type: 'api_error' } };
      }
      const message = errorBody?.error?.message || `HTTP ${response.status}`;
      throw new BodhiApiError(response.status, errorBody, message);
    }

    if (!response.body) {
      throw new BodhiError('network_error', 'Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }
            try {
              yield JSON.parse(data) as TRes;
            } catch (error) {
              this.logger.warn('Failed to parse SSE data:', data, error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async streamText(
    method: string,
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): Promise<StreamTextResult> {
    if (!this.serverUrl) {
      throw new BodhiError('not_initialized', 'Client not initialized - connection failed');
    }

    const url = `${this.serverUrl}${endpoint}`;
    const fetchHeaders: Record<string, string> = { ...headers };

    if (authenticated) {
      const token = await this._getAccessTokenRaw();
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    async function* bodyGenerator(): AsyncGenerator<string> {
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      status: response.status,
      headers: responseHeaders,
      body: bodyGenerator(),
    };
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

  get mcps(): Mcps {
    return (this._mcps ??= new Mcps(this));
  }

  // ============================================================================
  // Direct-Specific Methods
  // ============================================================================

  /**
   * Test connectivity to local server
   */
  async testConnectivity(): Promise<ConnectivityTestResult> {
    this.ensureInitialized();
    this.logger.debug('Testing connectivity to:', this.serverUrl);
    return testServerConnectivity(this.serverUrl!, this.apiTimeoutMs);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Serialize DirectClient state for persistence
   */
  serialize(): SerializedDirectState {
    return this.serverUrl ? { url: this.serverUrl } : {};
  }

  /**
   * Debug dump of DirectClient internal state
   */
  async debug(): Promise<Record<string, unknown>> {
    return {
      type: 'DirectClient',
      serverUrl: this.serverUrl,
      state: this.state,
      authState: await this.getAuthState(),
      authClientId: this.authClientId,
      authServerUrl: this.authServerUrl,
    };
  }

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  async requestAccess(
    body: CreateAccessRequest
  ): Promise<ApiResponse<CreateAccessRequestResponse>> {
    return this.sendApiRequest<CreateAccessRequest, CreateAccessRequestResponse>(
      'POST',
      '/bodhi/v1/apps/request-access',
      body,
      {},
      false
    );
  }

  async getAccessRequestStatus(
    requestId: string
  ): Promise<ApiResponse<AccessRequestStatusResponse>> {
    return this.sendApiRequest<void, AccessRequestStatusResponse>(
      'GET',
      `/bodhi/v1/apps/access-requests/${requestId}?app_client_id=${encodeURIComponent(this.authClientId)}`,
      undefined,
      {},
      false
    );
  }

  async pollAccessRequestStatus(
    requestId: string,
    options?: { intervalMs?: number; timeoutMs?: number }
  ): Promise<AccessRequestStatusResponse> {
    return pollAccessRequestUntilResolved(
      (id) => this.getAccessRequestStatus(id),
      requestId,
      options
    );
  }

  // ============================================================================
  // Abstract Methods (Platform-Specific)
  // ============================================================================

  abstract login(): Promise<AuthState>;
  protected abstract performOAuthPkce(scope: string): Promise<AuthState>;

  async getAuthState(): Promise<AuthState> {
    // storageKeys is built lazily in init() once serverUrl is known — guard against
    // pre-init calls so we don't read from undefined keys.
    if (!this.serverUrl) {
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    }
    const accessToken = await this._getAccessTokenRaw();
    if (!accessToken) {
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    }
    const userInfo = extractUserInfo(accessToken);
    const refreshToken = await this._storageGet(this.storageKeys.REFRESH_TOKEN);
    const expiresAtStr = await this._storageGet(this.storageKeys.EXPIRES_AT);
    return {
      status: 'authenticated',
      user: userInfo,
      accessToken,
      error: null,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAtStr ? parseInt(expiresAtStr, 10) : null,
      isTokenRefresh: false,
    };
  }

  async logout(): Promise<AuthState> {
    const state: AuthState = {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      error: null,
      refreshToken: null,
      expiresAt: null,
      isTokenRefresh: false,
    };
    // Nothing to revoke/clear pre-init — storageKeys isn't built until init().
    if (this.serverUrl) {
      await this.revokeRefreshToken();
      await this.clearAuthStorage();
    }
    this.setAuthState(state);
    return state;
  }

  protected async _getAccessTokenRaw(): Promise<string | null> {
    const accessToken = await this._storageGet(this.storageKeys.ACCESS_TOKEN);
    const expiresAtStr = await this._storageGet(this.storageKeys.EXPIRES_AT);

    if (!accessToken) return null;

    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() >= expiresAt - 5 * 1000) {
        // Token expired - try to refresh
        const refreshToken = await this._storageGet(this.storageKeys.REFRESH_TOKEN);
        if (refreshToken) {
          return this._tryRefreshToken(refreshToken);
        }
        return null;
      }
    }

    return accessToken;
  }

  /**
   * Try to refresh access token using refresh token
   * Race condition prevention: Returns existing promise if refresh already in progress
   */
  protected async _tryRefreshToken(refreshToken: string): Promise<string | null> {
    // If already refreshing, return the existing promise (avoids duplicate requests)
    if (this.refreshPromise) {
      this.logger.debug('Refresh already in progress, returning existing promise');
      return this.refreshPromise;
    }

    // Start refresh and store promise
    this.refreshPromise = this._doRefreshToken(refreshToken);

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async _doRefreshToken(refreshToken: string): Promise<string | null> {
    this.logger.debug('Refreshing access token');

    try {
      const result = await refreshAccessToken(
        this.authEndpoints.token,
        refreshToken,
        this.authClientId
      );

      if (result.success) {
        await this._storeRefreshedTokens(result.tokens);
        const userInfo = extractUserInfo(result.tokens.access_token);
        const expiresAt = Date.now() + result.tokens.expires_in * 1000;
        this.setAuthState({
          status: 'authenticated',
          user: userInfo,
          accessToken: result.tokens.access_token,
          error: null,
          refreshToken: result.tokens.refresh_token ?? null,
          expiresAt,
          isTokenRefresh: true,
        });
        this.logger.info('Token refreshed successfully');
        return result.tokens.access_token;
      }

      if (result.error === 'invalid_grant') {
        this.logger.warn('Refresh token expired or revoked, clearing tokens and logging out');
        await this.clearAuthStorage();
        this.setAuthState({
          status: 'unauthenticated',
          user: null,
          accessToken: null,
          error: null,
          refreshToken: null,
          expiresAt: null,
          isTokenRefresh: false,
        });
        return null;
      }
    } catch (error) {
      this.logger.warn('Token refresh failed:', error);
    }

    // Refresh failed (temp issue) - throw error (don't clear tokens)
    this.logger.warn('Token refresh failed, keeping tokens for manual retry');
    throw new BodhiError(
      'auth_error',
      'Access token expired and unable to refresh. Try logging out and logging in again.'
    );
  }

  /**
   * Store refreshed tokens
   */
  protected async _storeRefreshedTokens(tokens: RefreshTokenResponse): Promise<void> {
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    const storageData: Record<string, string> = {
      [this.storageKeys.ACCESS_TOKEN]: tokens.access_token,
      [this.storageKeys.EXPIRES_AT]: String(expiresAt),
    };

    // Update refresh token if provided (Keycloak token rotation)
    if (tokens.refresh_token) {
      storageData[this.storageKeys.REFRESH_TOKEN] = tokens.refresh_token;
    }

    await this._storageSet(storageData);
  }

  // ============================================================================
  // OAuth Helper Methods (Extracted Common Logic)
  // ============================================================================

  protected async exchangeCodeForTokens(code: string): Promise<void> {
    const codeVerifier = await this._storageGet(this.storageKeys.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const redirectUri = this._getRedirectUri();

    try {
      const response = await fetch(this.authEndpoints.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: this.authClientId,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokens = await response.json();
      const expiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;

      await this._storageSet({
        [this.storageKeys.ACCESS_TOKEN]: tokens.access_token,
        [this.storageKeys.REFRESH_TOKEN]: tokens.refresh_token || '',
        [this.storageKeys.EXPIRES_AT]: String(expiresAt),
      });
    } finally {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
    }
  }

  protected async revokeRefreshToken(keys: StorageKeys = this.storageKeys): Promise<void> {
    const refreshToken = await this._storageGet(keys.REFRESH_TOKEN);

    if (refreshToken) {
      try {
        const params = new URLSearchParams({
          token: refreshToken,
          client_id: this.authClientId,
          token_type_hint: 'refresh_token',
        });

        await fetch(this.authEndpoints.revoke, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        });
      } catch (error) {
        this.logger.warn('Token revocation failed:', error);
      }
    }
  }

  protected async clearAuthStorage(keys: StorageKeys = this.storageKeys): Promise<void> {
    await this._storageRemove([keys.ACCESS_TOKEN, keys.REFRESH_TOKEN, keys.EXPIRES_AT]);
  }

  /**
   * Rebuild OAuth storage keys using the current serverUrl.
   * Called after serverUrl is committed in `init()`. No-op if serverUrl is null.
   */
  private rebuildStorageKeys(): void {
    if (!this.serverUrl) return;
    const prefix = createStoragePrefixWithServerUrl(this.basePrefix, this.serverUrl);
    this.storageKeys = createStorageKeys(prefix);
  }

  /**
   * Revoke + purge OAuth tokens from a previous server URL's namespace. Called
   * when the user switches servers: the new server would not recognize the old
   * tokens anyway, and leaving them in storage is a security risk.
   *
   * Best-effort — if the old server is unreachable the revoke call fails silently
   * (see `revokeRefreshToken`); storage is cleared regardless.
   */
  private async clearPreviousServerTokens(oldServerUrl: string): Promise<void> {
    const oldKeys = createStorageKeys(
      createStoragePrefixWithServerUrl(this.basePrefix, oldServerUrl)
    );
    await this.revokeRefreshToken(oldKeys);
    await this._storageRemove([
      oldKeys.ACCESS_TOKEN,
      oldKeys.REFRESH_TOKEN,
      oldKeys.EXPIRES_AT,
      oldKeys.CODE_VERIFIER,
      oldKeys.STATE,
      oldKeys.ACCESS_REQUEST_ID,
    ]);
    this.setAuthState({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      error: null,
      refreshToken: null,
      expiresAt: null,
      isTokenRefresh: false,
    });
  }

  // ============================================================================
  // Token Injection
  // ============================================================================

  private async _bootstrapInitialTokens(tokens: InitialTokens): Promise<void> {
    const storageData: Record<string, string> = {
      [this.storageKeys.ACCESS_TOKEN]: tokens.accessToken,
    };
    if (tokens.refreshToken) {
      storageData[this.storageKeys.REFRESH_TOKEN] = tokens.refreshToken;
    }
    if (tokens.expiresAt !== undefined) {
      storageData[this.storageKeys.EXPIRES_AT] = String(tokens.expiresAt);
    }
    await this._storageSet(storageData);

    // Check if access token is expired
    const isExpired = tokens.expiresAt !== undefined && Date.now() >= tokens.expiresAt - 5 * 1000;

    if (!isExpired) {
      // Token is valid — set authenticated state
      const userInfo = extractUserInfo(tokens.accessToken);
      this.setAuthState({
        status: 'authenticated',
        user: userInfo,
        accessToken: tokens.accessToken,
        error: null,
        refreshToken: tokens.refreshToken ?? null,
        expiresAt: tokens.expiresAt ?? null,
        isTokenRefresh: false,
      });
    } else if (tokens.refreshToken) {
      // Token expired but refresh token available — attempt refresh
      // _doRefreshToken handles setAuthState with isTokenRefresh: true
      await this._tryRefreshToken(tokens.refreshToken);
    } else {
      // Token expired, no refresh token — unauthenticated
      this.setAuthState({
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      });
    }
  }

  // ============================================================================
  // Storage Methods
  // ============================================================================

  protected async _storageGet(key: string): Promise<string | null> {
    if (!this.storage) {
      throw new Error('No storage adapter configured');
    }
    return this.storage.get(key);
  }

  protected async _storageSet(items: Record<string, string | number>): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage adapter configured');
    }
    await this.storage.set(items);
  }

  protected async _storageRemove(keys: string[]): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage adapter configured');
    }
    await this.storage.remove(keys);
  }

  protected abstract _getRedirectUri(): string;
}
