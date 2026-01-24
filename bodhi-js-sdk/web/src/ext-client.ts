import {
  BACKEND_SERVER_NOT_REACHABLE,
  EXTENSION_STATE_NOT_FOUND,
  EXTENSION_STATE_NOT_INITIALIZED,
  Logger,
  NOOP_STATE_CALLBACK,
  PENDING_EXTENSION_READY,
  SERVER_ERROR_CODES,
  STORAGE_PREFIXES,
  backendServerNotReady,
  createApiError,
  createOAuthEndpoints,
  createOperationError,
  createStorageKeys,
  createStoragePrefixWithBasePath,
  extractUserInfo,
  generateCodeChallenge,
  generateCodeVerifier,
  getMissingToolsetScopeIds,
  getRequestedToolsetScopes,
  isApiResultError,
  isApiResultOperationError,
  isApiResultSuccess,
  refreshAccessToken,
  Chat,
  Models,
  Embeddings,
  type ApiResponseResult,
  type AuthState,
  type BackendServerState,
  type ClientState,
  type ExtensionState,
  type IExtensionClient,
  type InitParams,
  type LoginOptions,
  type LogLevel,
  type OAuthEndpoints,
  type RefreshTokenResponse,
  type ServerInfoResponse,
  type StateChangeCallback,
  type StorageKeys,
} from '@bodhiapp/bodhi-js-core';
import { type BodhiExtPublicApi, type StreamChunk } from '@bodhiapp/bodhi-browser-types';
import type { AppAccessRequest, AppAccessResponse, OpenAiApiError } from '@bodhiapp/ts-client';
import { DEFAULT_API_TIMEOUT_MS, POLL_INTERVAL, POLL_TIMEOUT } from './constants';

// Empty object type for future-proofing
export type SerializedWebExtensionState = { extensionId?: string };

/**
 * Configuration for WindowBodhiextClient
 * All fields are required - facade client normalizes config and provides defaults
 */
export interface WindowBodhiextClientConfig {
  authServerUrl: string;
  redirectUri: string;
  userScope: string;
  basePath: string;
  logLevel: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      intervalMs?: number;
    };
  };
}

/**
 * WindowBodhiextClient - web mode extension client using window.bodhiext
 *
 * Communicates with bodhi-browser-ext via window.bodhiext API
 *
 * Implements IExtensionClient interface with state callback for state changes
 * Additionally provides handleOAuthCallback for web-specific OAuth flow
 *
 */
export class WindowBodhiextClient implements IExtensionClient {
  private state: ExtensionState = EXTENSION_STATE_NOT_INITIALIZED;
  private logger: Logger;
  private bodhiext: BodhiExtPublicApi | null = null;
  private authClientId: string;
  private config: WindowBodhiextClientConfig;
  private authEndpoints: OAuthEndpoints;
  private onStateChange: StateChangeCallback;
  private refreshPromise: Promise<string | null> | null = null;
  private storageKeys: StorageKeys;
  private apiTimeoutMs: number;

  // OpenAI-compatible resource namespaces
  private _chat: Chat | undefined;
  private _models: Models | undefined;
  private _embeddings: Embeddings | undefined;

  constructor(
    authClientId: string,
    config: WindowBodhiextClientConfig,
    onStateChange?: StateChangeCallback
  ) {
    this.logger = new Logger('WindowBodhiextClient', config.logLevel);
    this.authClientId = authClientId;
    this.config = config;
    this.authEndpoints = createOAuthEndpoints(this.config.authServerUrl);
    this.onStateChange = onStateChange ?? NOOP_STATE_CALLBACK;
    const prefix = createStoragePrefixWithBasePath(config.basePath, STORAGE_PREFIXES.WEB_EXT);
    this.storageKeys = createStorageKeys(prefix);
    this.apiTimeoutMs = config.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  }

  /**
   * Set client state and notify callback
   */
  private setState(newState: ExtensionState): void {
    this.state = newState;
    this.logger.info(`{state: ${JSON.stringify(newState)}} - Setting client state`);
    this.onStateChange({ type: 'client-state', state: newState });
  }

  /**
   * Set auth state and notify callback
   */
  private setAuthState(authState: AuthState): void {
    this.onStateChange({ type: 'auth-state', state: authState });
  }

  /**
   * Set or update the state change callback
   */
  setStateCallback(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  // ============================================================================
  // Extension Communication
  // ============================================================================

  /**
   * Ensure bodhiext is available, attempting to acquire it if not already set
   * @throws OperationError if client not initialized
   */
  private ensureBodhiext(): void {
    if (!this.bodhiext && window.bodhiext) {
      this.logger.info('Acquiring window.bodhiext reference');
      this.bodhiext = window.bodhiext;
    }
    if (!this.bodhiext) {
      throw createOperationError('Client not initialized', 'extension_error');
    }
  }

  /**
   * Send extension request via window.bodhiext.sendExtRequest
   */

  async sendExtRequest<TParams = void, TRes = unknown>(
    action: string,
    params?: TParams
  ): Promise<TRes> {
    this.ensureBodhiext();
    return this.bodhiext!.sendExtRequest(action, params) as Promise<TRes>;
  }

  /**
   * Send API message via window.bodhiext.sendApiRequest
   * Converts ApiResponse to ApiResponseResult
   */
  async sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponseResult<TRes>> {
    try {
      this.ensureBodhiext();
    } catch (err) {
      return {
        error: {
          message: err instanceof Error ? err.message : String(err),
          type: 'extension_error',
        },
      };
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `[bodhi-js-sdk/web] network timeout: api request not completed within configured/default timeout of ${this.apiTimeoutMs}ms`
              )
            ),
          this.apiTimeoutMs
        )
      );

      const apiPromise = (async () => {
        let requestHeaders = headers || {};

        // Token injection for authenticated requests
        if (authenticated) {
          const accessToken = await this._getAccessTokenRaw();
          if (!accessToken) {
            return {
              error: {
                message: 'Not authenticated. Please log in first.',
                type: 'extension_error',
              },
            };
          }
          requestHeaders = {
            ...requestHeaders,
            Authorization: `Bearer ${accessToken}`,
          };
        }

        return this.bodhiext!.sendApiRequest<unknown, TRes>(method, endpoint, body, requestHeaders);
      })();

      return await Promise.race([apiPromise, timeoutPromise]);
    } catch (e) {
      const errorObj = (e as { error?: { message?: string; type?: string } })?.error;
      const message = errorObj?.message ?? (e instanceof Error ? e.message : String(e));
      const errorType = errorObj?.type || 'network_error';
      return {
        error: {
          message,
          type: errorType,
        },
      };
    }
  }

  /**
   * Get current client state
   */
  getState(): ClientState {
    return this.state;
  }

  isClientInitialized(): boolean {
    return this.state.extension === 'ready';
  }

  isServerReady(): boolean {
    return this.isClientInitialized() && this.state.server.status === 'ready';
  }

  /**
   * Initialize extension discovery with optional timeout
   * Returns ExtensionState with extension and server status
   *
   * Note: Web mode uses stateless discovery (always polls for window.bodhiext)
   * No extensionId storage/restoration needed - window.bodhiext handle is ephemeral
   */
  async init(params: InitParams = {}): Promise<ExtensionState> {
    // testConnection: false, selectedConnection: false → not-initialized
    if (!params.testConnection && !params.selectedConnection) {
      this.logger.info('No testConnection or selectedConnection, returning not-initialized state');
      return EXTENSION_STATE_NOT_INITIALIZED;
    }

    // IDEMPOTENCY: If already have handle and not testing, skip polling
    if (this.bodhiext && !params.testConnection) {
      this.logger.debug('Already have bodhiext handle, skipping polling');
      return this.state;
    }

    // Only poll if don't have handle yet
    if (!this.bodhiext) {
      // Priority: params > constructor defaults > constants
      const timeoutMs =
        params.timeoutMs ?? this.config.initParams?.extension?.timeoutMs ?? POLL_TIMEOUT;
      const intervalMs =
        params.intervalMs ?? this.config.initParams?.extension?.intervalMs ?? POLL_INTERVAL;
      const startTime = Date.now();

      // Poll for window.bodhiext
      const found = await new Promise<boolean>((resolve) => {
        const check = () => {
          if (window.bodhiext) {
            this.bodhiext = window.bodhiext;
            resolve(true);
            return;
          }
          if (Date.now() - startTime >= timeoutMs) {
            resolve(false);
            return;
          }
          setTimeout(check, intervalMs);
        };
        check();
      });

      if (!found) {
        this.logger.warn(`Extension discovery timed out`);
        this.setState(EXTENSION_STATE_NOT_FOUND);
        return this.state;
      }
    }

    // Have handle - build state
    const extensionId = await this.bodhiext!.getExtensionId();
    this.logger.info(`Extension discovered: ${extensionId}`);

    const state: ExtensionState = {
      type: 'extension',
      extension: 'ready',
      extensionId,
      server: PENDING_EXTENSION_READY,
    };

    // Test server connectivity if requested
    if (params.testConnection) {
      try {
        const serverState = await this.getServerState();
        this.setState({ ...state, server: serverState });
        this.logger.info(`Server connectivity tested: ${serverState.status}`);
      } catch (error) {
        this.logger.error(`Failed to get server state:`, error);
        this.setState({ ...state, server: BACKEND_SERVER_NOT_REACHABLE });
      }
    } else {
      this.setState(state);
    }

    return this.state;
  }

  // ============================================================================
  // OAuth Methods
  // ============================================================================

  /**
   * Request resource access scope from backend
   * Required for authenticated API access
   */
  private async requestResourceAccess(
    toolsetScopeIds?: string[],
    version?: string
  ): Promise<ApiResponseResult<AppAccessResponse>> {
    this.ensureBodhiext();

    const requestBody: AppAccessRequest = {
      app_client_id: this.authClientId,
      ...(toolsetScopeIds && { toolset_scope_ids: toolsetScopeIds }),
      ...(version && { version }),
    };

    return this.bodhiext!.sendApiRequest<AppAccessRequest, AppAccessResponse>(
      'POST',
      '/bodhi/v1/apps/request-access',
      requestBody
    );
  }

  /**
   * Login via browser redirect OAuth2 + PKCE flow
   * @param options - Optional login options (toolsetScopeIds, version)
   * @returns AuthState (though in practice, this redirects and never returns)
   */
  async login(options?: LoginOptions): Promise<AuthState> {
    // Check if already logged in
    const existingAuth = await this.getAuthState();
    if (existingAuth.status === 'authenticated') {
      return existingAuth;
    }

    // Ensure extension discovered
    this.ensureBodhiext();

    // Request resource access scope
    const result = await this.requestResourceAccess(options?.toolsetScopeIds, options?.version);

    if (isApiResultOperationError(result)) {
      throw createOperationError(result.error.message, result.error.type);
    }

    if (isApiResultError(result)) {
      const { message } = result.body.error;
      throw createOperationError(message, 'auth_error');
    }

    if (!isApiResultSuccess(result)) {
      throw createOperationError(`Unexpected HTTP ${result.status}`, 'auth_error');
    }

    const resourceScope = result.body.scope;
    localStorage.setItem(this.storageKeys.RESOURCE_SCOPE, resourceScope);

    // Extract toolset scopes from response
    const toolsets = result.body.toolsets || [];

    // Validate requested toolset scope IDs are in response
    const missingScopeIds = getMissingToolsetScopeIds(options?.toolsetScopeIds, toolsets);
    if (missingScopeIds.length > 0) {
      throw createOperationError(
        `toolsetScopeIds not received back from request-access call: [${missingScopeIds.join(', ')}], check developer console on configuring the toolset scopes correctly`,
        'auth_error'
      );
    }

    // Only include scopes for requested toolset IDs (empty string if none requested)
    const toolsetScopesStr = getRequestedToolsetScopes(options?.toolsetScopeIds, toolsets);

    // Generate PKCE verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = generateCodeVerifier();

    // Store verifier and state for callback
    localStorage.setItem(this.storageKeys.CODE_VERIFIER, codeVerifier);
    localStorage.setItem(this.storageKeys.STATE, state);

    // Build OAuth authorization URL
    const scopes = [
      'openid',
      'profile',
      'email',
      'roles',
      this.config.userScope,
      resourceScope,
      ...(toolsetScopesStr ? toolsetScopesStr.split(' ') : []),
    ];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.authClientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${this.authEndpoints.authorize}?${params}`;

    // Redirect to authorization server
    window.location.href = authUrl;

    // TypeScript requires a return statement, but this code never executes
    // because the browser redirects above
    return new Promise(() => {});
  }

  /**
   * Handle OAuth callback with authorization code
   * Should be called from callback page with extracted URL params
   * @returns AuthState with login state and user info
   */
  async handleOAuthCallback(code: string, state: string): Promise<AuthState> {
    // Validate state to prevent CSRF
    const storedState = localStorage.getItem(this.storageKeys.STATE);
    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Exchange code for tokens
    await this.exchangeCodeForTokens(code);

    // Clean up temporary storage
    localStorage.removeItem(this.storageKeys.CODE_VERIFIER);
    localStorage.removeItem(this.storageKeys.STATE);

    const authState = await this.getAuthState();

    if (authState.status !== 'authenticated') {
      throw new Error('Login failed');
    }

    this.setAuthState(authState);
    return authState;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<void> {
    const codeVerifier = localStorage.getItem(this.storageKeys.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.authClientId,
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(this.authEndpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();

    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }

    // Store tokens in localStorage
    localStorage.setItem(this.storageKeys.ACCESS_TOKEN, tokenData.access_token);
    if (tokenData.refresh_token) {
      localStorage.setItem(this.storageKeys.REFRESH_TOKEN, tokenData.refresh_token);
    }

    // Calculate and store expiration time
    if (tokenData.expires_in) {
      const expiresAt = Date.now() + tokenData.expires_in * 1000;
      localStorage.setItem(this.storageKeys.EXPIRES_AT, expiresAt.toString());
    }
  }

  /**
   * Logout user and revoke tokens
   * @returns AuthLoggedOut with logged out state
   */
  async logout(): Promise<AuthState> {
    const refreshToken = localStorage.getItem(this.storageKeys.REFRESH_TOKEN);

    // Attempt to revoke token at auth server
    if (refreshToken) {
      try {
        const params = new URLSearchParams({
          token: refreshToken,
          client_id: this.authClientId,
          token_type_hint: 'refresh_token',
        });

        await fetch(this.authEndpoints.revoke, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });
      } catch (error) {
        this.logger.warn('Token revocation failed:', error);
      }
    }

    // Clear all OAuth-related localStorage keys
    localStorage.removeItem(this.storageKeys.ACCESS_TOKEN);
    localStorage.removeItem(this.storageKeys.REFRESH_TOKEN);
    localStorage.removeItem(this.storageKeys.EXPIRES_AT);
    localStorage.removeItem(this.storageKeys.CODE_VERIFIER);
    localStorage.removeItem(this.storageKeys.STATE);
    localStorage.removeItem(this.storageKeys.RESOURCE_SCOPE);

    const result: AuthState = {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      error: null,
    };

    this.setAuthState(result);
    return result;
  }

  /**
   * Get current authentication state
   */
  async getAuthState(): Promise<AuthState> {
    const accessToken = await this._getAccessTokenRaw();

    if (!accessToken) {
      return { status: 'unauthenticated', user: null, accessToken: null, error: null };
    }

    try {
      const userInfo = extractUserInfo(accessToken);
      return { status: 'authenticated', user: userInfo, accessToken, error: null };
    } catch (error) {
      this.logger.error('Failed to parse token:', error);
      return { status: 'unauthenticated', user: null, accessToken: null, error: null };
    }
  }

  /**
   * Get current access token
   * Returns null if not logged in or token expired
   */
  protected async _getAccessTokenRaw(): Promise<string | null> {
    const accessToken = localStorage.getItem(this.storageKeys.ACCESS_TOKEN);
    const expiresAt = localStorage.getItem(this.storageKeys.EXPIRES_AT);

    if (!accessToken) {
      return null;
    }

    // Check if token is expired
    if (expiresAt) {
      const expirationTime = parseInt(expiresAt, 10);
      if (Date.now() >= expirationTime - 5 * 1000) {
        // Token expired - try to refresh
        const refreshToken = localStorage.getItem(this.storageKeys.REFRESH_TOKEN);
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
  private async _tryRefreshToken(refreshToken: string): Promise<string | null> {
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
        this._storeRefreshedTokens(result.tokens);
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
        this.clearAuthStorage();
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

  private clearAuthStorage() {
    localStorage.removeItem(this.storageKeys.ACCESS_TOKEN);
    localStorage.removeItem(this.storageKeys.REFRESH_TOKEN);
    localStorage.removeItem(this.storageKeys.EXPIRES_AT);
    localStorage.removeItem(this.storageKeys.RESOURCE_SCOPE);
  }

  /**
   * Store refreshed tokens
   */
  private _storeRefreshedTokens(tokens: RefreshTokenResponse): void {
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    localStorage.setItem(this.storageKeys.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(this.storageKeys.EXPIRES_AT, String(expiresAt));

    // Update refresh token if provided (Keycloak token rotation)
    if (tokens.refresh_token) {
      localStorage.setItem(this.storageKeys.REFRESH_TOKEN, tokens.refresh_token);
    }
  }

  /**
   * Ping API
   */
  async pingApi(): Promise<ApiResponseResult<{ message: string }>> {
    return this.sendApiRequest<void, { message: string }>('GET', '/ping');
  }

  /**
   * Get backend server state
   * Calls /bodhi/v1/info and returns structured server state
   */
  async getServerState(): Promise<BackendServerState> {
    const result = await this.sendApiRequest<void, ServerInfoResponse>('GET', '/bodhi/v1/info');

    if (isApiResultOperationError(result)) {
      return BACKEND_SERVER_NOT_REACHABLE;
    }

    if (!isApiResultSuccess(result)) {
      return BACKEND_SERVER_NOT_REACHABLE;
    }

    const body = result.body;

    switch (body.status) {
      case 'ready':
        return { status: 'ready', version: body.version || 'unknown', error: null };
      case 'setup':
        return backendServerNotReady('setup', body.version || 'unknown');
      case 'resource-admin':
        return backendServerNotReady('resource-admin', body.version || 'unknown');
      case 'error':
        return backendServerNotReady(
          'error',
          body.version || 'unknown',
          body.error
            ? { message: body.error.message, type: body.error.type }
            : SERVER_ERROR_CODES.SERVER_NOT_READY
        );
      default:
        return BACKEND_SERVER_NOT_REACHABLE;
    }
  }

  /**
   * Generic streaming via window.bodhiext.sendStreamRequest
   * Wraps ReadableStream as AsyncGenerator
   */
  async *stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): AsyncGenerator<TRes> {
    this.ensureBodhiext();
    let requestHeaders = headers || {};
    // Token injection for authenticated requests
    if (authenticated) {
      const accessToken = await this._getAccessTokenRaw();
      if (!accessToken) {
        throw createOperationError('Not authenticated. Please log in first.', 'auth_error');
      }
      requestHeaders = {
        ...requestHeaders,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    const stream = this.bodhiext!.sendStreamRequest<TReq>(method, endpoint, body, requestHeaders);
    const reader = stream.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done || (value as StreamChunk)?.done) {
          break;
        }
        yield (value as StreamChunk).body as TRes;
      }
    } catch (err) {
      // Convert discriminated error types to ConnectionError/ApiError
      if (err instanceof Error) {
        // Check for 'response' field = API error
        if ('response' in err) {
          const apiErr = err as Error & { response: { status: number; body: OpenAiApiError } };
          throw createApiError(err.message, apiErr.response.status, apiErr.response.body);
        }
        // Check for 'error' field = network/extension error
        if ('error' in err) {
          throw createOperationError(err.message, 'extension_error');
        }
        // Fallback for other errors
        throw createOperationError(err.message, 'extension_error');
      }
      throw err;
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

  /**
   * Serialize web extension client state (all transient, nothing to persist)
   */
  serialize(): SerializedWebExtensionState {
    return {
      extensionId:
        this.state.type === 'extension' && this.state.extension === 'ready'
          ? this.state.extensionId
          : undefined,
    } as SerializedWebExtensionState;
  }

  /**
   * Debug dump of WindowBodhiextClient internal state
   */
  async debug(): Promise<Record<string, unknown>> {
    return {
      type: 'WindowBodhiextClient',
      state: this.state,
      authState: await this.getAuthState(),
      bodhiextAvailable: this.bodhiext !== null,
      authClientId: this.authClientId,
      authServerUrl: this.config.authServerUrl,
      redirectUri: this.config.redirectUri,
      userScope: this.config.userScope,
    };
  }
}
