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
  CreateAccessRequest,
  CreateAccessRequestResponse,
  DeploymentMode,
  UserScope,
} from '@bodhiapp/ts-client';
import { DEFAULT_API_TIMEOUT_MS } from './constants';
import { createOperationError } from './errors';
import { pollAccessRequestUntilResolved } from './access-request';
import type { IDirectClient } from './interface';
import { Logger } from './logger';
import { Chat, Models, Embeddings, Toolsets, Mcps } from './openai-client-compat';
import {
  createOAuthEndpoints,
  extractUserInfo,
  refreshAccessToken,
  type OAuthEndpoints,
  type RefreshTokenResponse,
} from './oauth';
import { createStorageKeys, type StorageKeys } from './storage';
import {
  type ApiResponseResult,
  type AuthState,
  type BackendServerState,
  type ClientState,
  type DirectState,
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
  userRole: UserScope;
  storagePrefix: string;
  logLevel: LogLevel;
  loggerPrefix: string;
  apiTimeoutMs?: number;
}

/**
 * DirectClientBase - Abstract base implementing common HTTP/streaming logic
 */
export abstract class DirectClientBase implements IDirectClient {
  protected logger: Logger;
  protected serverUrl: string | null = null;
  protected authClientId: string;
  protected authServerUrl: string;
  protected userRole: UserScope;
  protected authEndpoints: OAuthEndpoints;
  protected storageKeys: StorageKeys;
  protected state: DirectState = DIRECT_STATE_NOT_INITIALIZED;
  private onStateChange: StateChangeCallback;
  private refreshPromise: Promise<string | null> | null = null;
  private apiTimeoutMs: number;

  // OpenAI-compatible resource namespaces
  private _chat: Chat | undefined;
  private _models: Models | undefined;
  private _embeddings: Embeddings | undefined;
  private _toolsets: Toolsets | undefined;
  private _mcps: Mcps | undefined;

  constructor(config: DirectClientBaseConfig, onStateChange?: StateChangeCallback) {
    this.logger = new Logger(config.loggerPrefix, config.logLevel);
    this.authClientId = config.authClientId;
    this.authServerUrl = config.authServerUrl;
    this.userRole = config.userRole;
    this.authEndpoints = createOAuthEndpoints(this.authServerUrl);
    this.storageKeys = createStorageKeys(config.storagePrefix);
    this.onStateChange = onStateChange ?? NOOP_STATE_CALLBACK;
    this.apiTimeoutMs = config.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
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
      this.logger.debug('Already initialized with serverUrl, skipping init');
      return this.state;
    }

    this.serverUrl = serverUrl;

    if (!this.serverUrl) {
      this.logger.info('No serverUrl provided, returning not-initialized state');
      return DIRECT_STATE_NOT_INITIALIZED;
    }

    this.logger.info('Initializing with serverUrl:', this.serverUrl);
    // testConnection: true → initialize AND test server (regardless of selectedConnection)
    if (params.testConnection) {
      const connectivity = await this.testConnectivity();
      let serverState: BackendServerState;

      if (connectivity.success && connectivity.serverInfo) {
        // Parse server info to determine state
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
        } else if (
          status === 'setup' ||
          status === 'resource_admin' ||
          status === 'tenant_selection' ||
          status === 'error'
        ) {
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
      throw createOperationError(
        'DirectClient not initialized. Call init(serverUrl) first.',
        'not-initialized'
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
  ): Promise<ApiResponseResult<TRes>> {
    if (!this.serverUrl) {
      return {
        error: {
          message: 'Client not initialized - connection failed',
          type: 'not-initialized',
        },
      };
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
        return {
          error: {
            message: `[bodhi-js-sdk/direct] network timeout: api request not completed within configured/default timeout of ${this.apiTimeoutMs}ms`,
            type: 'network_error',
          },
        };
      }
      return {
        error: {
          message: `Network error: ${errorMessage}`,
          type: 'network_error',
        },
      };
    }
  }

  async pingApi(): Promise<ApiResponseResult<{ message: string }>> {
    return this.sendApiRequest<void, { message: string }>('GET', '/ping', undefined, {}, false);
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
      case 'tenant_selection':
        return { status: 'tenant_selection', version: info.version, error: null, ...baseFields };
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
      throw createOperationError('Client not initialized - connection failed', 'not-initialized');
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

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
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
      userRole: this.userRole,
    };
  }

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  async requestAccess(
    body: CreateAccessRequest
  ): Promise<ApiResponseResult<CreateAccessRequestResponse>> {
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
  ): Promise<ApiResponseResult<AccessRequestStatusResponse>> {
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
  abstract logout(): Promise<AuthState>;
  protected abstract performOAuthPkce(scope: string): Promise<AuthState>;

  async getAuthState(): Promise<AuthState> {
    const accessToken = await this._getAccessTokenRaw();
    if (!accessToken) {
      return { status: 'unauthenticated', user: null, accessToken: null, error: null };
    }
    const userInfo = extractUserInfo(accessToken);
    return { status: 'authenticated', user: userInfo, accessToken, error: null };
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
        this.setAuthState({
          status: 'authenticated',
          user: userInfo,
          accessToken: result.tokens.access_token,
          error: null,
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
        });
        return null;
      }
    } catch (error) {
      this.logger.warn('Token refresh failed:', error);
    }

    // Refresh failed (temp issue) - throw error (don't clear tokens)
    this.logger.warn('Token refresh failed, keeping tokens for manual retry');
    throw createOperationError(
      'Access token expired and unable to refresh. Try logging out and logging in again.',
      'token_refresh_failed'
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

    await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
  }

  protected async revokeRefreshToken(): Promise<void> {
    const refreshToken = await this._storageGet(this.storageKeys.REFRESH_TOKEN);

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

  protected async clearAuthStorage(): Promise<void> {
    await this._storageRemove([
      this.storageKeys.ACCESS_TOKEN,
      this.storageKeys.REFRESH_TOKEN,
      this.storageKeys.EXPIRES_AT,
    ]);
  }

  // ============================================================================
  // Abstract Storage Methods (Platform-Specific)
  // ============================================================================

  protected abstract _storageGet(key: string): Promise<string | null>;
  protected abstract _storageSet(items: Record<string, string | number>): Promise<void>;
  protected abstract _storageRemove(keys: string[]): Promise<void>;
  protected abstract _getRedirectUri(): string;
}
