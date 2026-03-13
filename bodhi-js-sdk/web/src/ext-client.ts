import type {
  AccessRequestStatusResponse,
  CreateAccessRequest,
  CreateAccessRequestResponse,
  UserScope,
} from '@bodhiapp/ts-client';
import {
  AccessRequestBuilder,
  BACKEND_SERVER_NOT_REACHABLE,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  pollAccessRequestUntilResolved,
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
  isApiResultOperationError,
  isApiResultSuccess,
  openPopupReview,
  refreshAccessToken,
  Chat,
  Models,
  Embeddings,
  Toolsets,
  Mcps,
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
  userRole: UserScope;
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
  private _toolsets: Toolsets | undefined;
  private _mcps: Mcps | undefined;

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
   * Login via access-request flow with popup or redirect
   * @param options - Optional login options
   * @returns AuthState
   */
  async login(options?: LoginOptions): Promise<AuthState> {
    // Check if already logged in
    const existingAuth = await this.getAuthState();
    if (existingAuth.status === 'authenticated') {
      return existingAuth;
    }

    // Ensure extension discovered
    this.ensureBodhiext();

    const userRole = options?.userRole ?? this.config.userRole;
    const flowType = options?.flowType ?? 'popup';

    // Step 1: Create access request
    options?.onProgress?.('requesting');
    const builder = new AccessRequestBuilder(this.authClientId)
      .requestedRole(userRole)
      .flowType(flowType);

    if (options?.requested) {
      builder.requested(options.requested);
    }
    if (flowType === 'redirect') {
      const redirectUrl = options?.redirectUrl ?? this.config.redirectUri;
      builder.redirectUrl(redirectUrl);
    }

    const accessRequestBody = builder.build();
    const accessRequestResult = await this.requestAccess(accessRequestBody);

    if (isApiResultOperationError(accessRequestResult)) {
      throw createOperationError(accessRequestResult.error.message, accessRequestResult.error.type);
    }
    if (!isApiResultSuccess(accessRequestResult)) {
      throw createOperationError(
        `Access request failed: HTTP ${accessRequestResult.status}`,
        'auth_error'
      );
    }

    const { id: requestId, review_url: reviewUrl } = accessRequestResult.body;
    options?.onProgress?.('reviewing');

    let accessRequestScope: string | null | undefined;

    if (flowType === 'popup') {
      // Popup flow: open review popup and poll
      const pollFn = async () => {
        const statusResult = await this.getAccessRequestStatus(requestId);
        if (!isApiResultSuccess(statusResult)) return null;
        const { status, access_request_scope } = statusResult.body;
        if (status === 'approved')
          return { approved: true, accessRequestScope: access_request_scope ?? undefined };
        if (['denied', 'failed', 'expired'].includes(status)) return { approved: false };
        return null; // still pending
      };

      const reviewResult = await openPopupReview(reviewUrl, pollFn, {
        intervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        timeoutMs: options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
      });

      if (!reviewResult.approved) {
        throw createOperationError('Access request was denied or expired', 'auth_error');
      }
      accessRequestScope = reviewResult.accessRequestScope;
    } else {
      // Redirect flow: store requestId and redirect
      localStorage.setItem(this.storageKeys.ACCESS_REQUEST_ID, requestId);
      window.location.href = reviewUrl;
      return new Promise(() => {}); // never resolves
    }

    options?.onProgress?.('authenticating');
    return this.performOAuthPkce(`openid profile email roles ${accessRequestScope ?? ''}`.trim());
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

    const version = body.version || 'unknown';
    switch (body.status) {
      case 'ready':
        return {
          status: 'ready',
          version,
          error: null,
          deployment: body.deployment ?? null,
          client_id: body.client_id ?? null,
        };
      case 'setup':
        return backendServerNotReady('setup', version, undefined, body.deployment, body.client_id);
      case 'resource_admin':
        return backendServerNotReady(
          'resource_admin',
          version,
          undefined,
          body.deployment,
          body.client_id
        );
      case 'tenant_selection':
        return {
          status: 'tenant_selection',
          version,
          error: null,
          deployment: body.deployment ?? null,
          client_id: body.client_id ?? null,
        };
      case 'error':
        return backendServerNotReady(
          'error',
          version,
          body.error
            ? { message: body.error.message, type: body.error.type }
            : SERVER_ERROR_CODES.SERVER_NOT_READY,
          body.deployment,
          body.client_id
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
          const apiErr = err as Error & { response: { status: number; body: any } };
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

  get toolsets(): Toolsets {
    return (this._toolsets ??= new Toolsets(this));
  }

  get mcps(): Mcps {
    return (this._mcps ??= new Mcps(this));
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

  private async performOAuthPkce(scope: string): Promise<AuthState> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();

    localStorage.setItem(this.storageKeys.CODE_VERIFIER, codeVerifier);
    localStorage.setItem(this.storageKeys.STATE, state);

    const scopes = scope.split(' ').filter(Boolean);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.authClientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${this.authEndpoints.authorize}?${params}`;
    return new Promise(() => {});
  }

  async handleAccessRequestCallback(requestId: string): Promise<AuthState> {
    // Poll once to get the approved status
    const statusResult = await this.getAccessRequestStatus(requestId);
    if (!isApiResultSuccess(statusResult)) {
      throw createOperationError('Failed to get access request status', 'auth_error');
    }
    const { status, access_request_scope } = statusResult.body;
    if (status !== 'approved') {
      throw createOperationError(`Access request is not approved: ${status}`, 'auth_error');
    }
    const scope = `openid profile email roles ${access_request_scope ?? ''}`.trim();
    localStorage.removeItem(this.storageKeys.ACCESS_REQUEST_ID);
    return this.performOAuthPkce(scope);
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
      userRole: this.config.userRole,
    };
  }
}
