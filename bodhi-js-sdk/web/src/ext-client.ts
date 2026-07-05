import type {
  CreateAccessRequest,
  CreateAccessRequestResponse,
  PingResponse,
} from '@bodhiapp/ts-client';
import {
  AccessRequestBuilder,
  BACKEND_SERVER_NOT_REACHABLE,
  BASE_OAUTH_SCOPE,
  buildAuthorizeUrl,
  buildErrorUrl,
  buildReviewUrl,
  EXTENSION_STATE_NOT_FOUND,
  EXTENSION_STATE_NOT_INITIALIZED,
  Logger,
  NOOP_STATE_CALLBACK,
  PENDING_EXTENSION_READY,
  SERVER_ERROR_CODES,
  STORAGE_PREFIXES,
  backendServerNotReady,
  createOAuthEndpoints,
  createOperationError,
  createStorageKeys,
  createStoragePrefixWithNamespace,
  extractUserInfo,
  generateCodeChallenge,
  generateCodeVerifier,
  refreshAccessToken,
  BodhiError,
  BodhiApiError,
  unwrapResponse,
  Chat,
  Models,
  Embeddings,
  Mcps,
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
  type StreamTextResult,
} from '@bodhiapp/bodhi-js-core';
import {
  type ApiResponse,
  type BodhiExtPublicApi,
  type StreamChunk,
} from '@bodhiapp/bodhi-browser-types';
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
    const prefix = createStoragePrefixWithNamespace(config.basePath, STORAGE_PREFIXES.WEB_EXT);
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
   * @throws BodhiError if client not initialized
   */
  private ensureBodhiext(): void {
    if (!this.bodhiext && window.bodhiext) {
      this.logger.info('Acquiring window.bodhiext reference');
      this.bodhiext = window.bodhiext;
    }
    if (!this.bodhiext) {
      throw createOperationError('not_initialized', 'Client not initialized');
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
   * @throws BodhiError on operational errors (extension not ready, auth, network, timeout)
   */
  async sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponse<TRes>> {
    this.ensureBodhiext();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new BodhiError(
                'timeout_error',
                `[bodhi-js-sdk/web] network timeout: api request not completed within configured/default timeout of ${this.apiTimeoutMs}ms`
              )
            ),
          this.apiTimeoutMs
        )
      );

      const apiPromise = (async () => {
        let requestHeaders = headers || {};

        // Token injection for authenticated requests (attached only when a token exists)
        if (authenticated) {
          const accessToken = await this._getAccessTokenRaw();
          if (accessToken) {
            requestHeaders = {
              ...requestHeaders,
              Authorization: `Bearer ${accessToken}`,
            };
          }
        }

        return this.bodhiext!.sendApiRequest<unknown, TRes>(method, endpoint, body, requestHeaders);
      })();

      return await Promise.race([apiPromise, timeoutPromise]);
    } catch (e) {
      // Same-bundle errors (e.g., SDK's own timeout BodhiError)
      if (e instanceof BodhiApiError) throw e;
      if (e instanceof BodhiError) throw e;
      // Cross-bundle: inject.ts errors use different class instances.
      // Use name discriminant + field duck-typing to reconstruct.
      if (e instanceof Error) {
        const err = e as unknown as Record<string, unknown>;
        if (e.name === 'BodhiApiError' && typeof err.status === 'number' && err.body != null) {
          throw new BodhiApiError(
            err.status as number,
            err.body as any,
            e.message,
            err.headers as Record<string, string> | undefined
          );
        }
        if (e.name === 'BodhiError' && typeof err.code === 'string') {
          throw new BodhiError(err.code as string, e.message);
        }
        throw new BodhiError('network_error', e.message);
      }
      throw new BodhiError('network_error', String(e));
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
    // Check if already logged in (unless exchanging to widen grants)
    const existingAuth = await this.getAuthState();
    if (existingAuth.status === 'authenticated' && !options?.exchange) {
      return existingAuth;
    }

    // Ensure extension discovered
    this.ensureBodhiext();

    const userRole = options?.userRole ?? 'scope_user_user';
    const redirectUri = this.config.redirectUri;

    options?.onProgress?.('requesting');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();
    localStorage.setItem(this.storageKeys.CODE_VERIFIER, codeVerifier);
    localStorage.setItem(this.storageKeys.STATE, state);

    const authUrl = buildAuthorizeUrl(this.authEndpoints, {
      clientId: this.authClientId,
      redirectUri,
      scope: BASE_OAUTH_SCOPE,
      state,
      codeChallenge,
    });
    const errorUrl = buildErrorUrl(redirectUri);

    const builder = new AccessRequestBuilder(this.authClientId).requestedRole(userRole);
    if (options?.requested) builder.requested(options.requested);
    if (options?.exchange) builder.exchange(true);
    const accessRequestResult = await this.requestAccess(builder.build());
    const { review_url: reviewUrl } = unwrapResponse(accessRequestResult);

    options?.onProgress?.('reviewing');
    window.location.href = buildReviewUrl(reviewUrl, authUrl, errorUrl);
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

    const result: AuthState = {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      error: null,
      refreshToken: null,
      expiresAt: null,
      isTokenRefresh: false,
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

    try {
      const userInfo = extractUserInfo(accessToken);
      return {
        status: 'authenticated',
        user: userInfo,
        accessToken,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    } catch (error) {
      this.logger.error('Failed to parse token:', error);
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
          refreshToken: null,
          expiresAt: null,
          isTokenRefresh: true,
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
    throw createOperationError(
      'auth_error',
      'Access token expired and unable to refresh. Try logging out and logging in again.'
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
  async pingApi(): Promise<ApiResponse<PingResponse>> {
    return this.sendApiRequest<void, PingResponse>('GET', '/ping');
  }

  /**
   * Get backend server state
   * Calls /bodhi/v1/info and returns structured server state
   */
  async getServerState(): Promise<BackendServerState> {
    try {
      const result = await this.sendApiRequest<void, ServerInfoResponse>('GET', '/bodhi/v1/info');

      if (result.status >= 400) {
        return BACKEND_SERVER_NOT_REACHABLE;
      }

      const body = result.body as ServerInfoResponse;

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
          return backendServerNotReady(
            'setup',
            version,
            undefined,
            body.deployment,
            body.client_id
          );
        case 'resource_admin':
          return backendServerNotReady(
            'resource_admin',
            version,
            undefined,
            body.deployment,
            body.client_id
          );
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
    } catch {
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
        throw createOperationError('auth_error', 'Not authenticated. Please log in first.');
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
      // Same-bundle errors
      if (err instanceof BodhiApiError) throw err;
      if (err instanceof BodhiError) throw err;
      // Cross-bundle: inject.ts creates errors in IIFE context.
      // Use name discriminant + field duck-typing to reconstruct.
      if (err instanceof Error) {
        const e = err as unknown as Record<string, unknown>;
        if (err.name === 'BodhiApiError' && typeof e.status === 'number' && e.body != null) {
          throw new BodhiApiError(
            e.status as number,
            e.body as any,
            err.message,
            e.headers as Record<string, string> | undefined
          );
        }
        if (err.name === 'BodhiError' && typeof e.code === 'string') {
          throw new BodhiError(e.code as string, err.message);
        }
        throw new BodhiError('extension_error', err.message);
      }
      throw err;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Raw text streaming via window.bodhiext.sendStreamText
   * Returns status, headers, and async generator of raw text chunks.
   * No SSE/JSON parsing. Non-2xx responses are returned as data (not thrown).
   */
  async streamText(
    method: string,
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): Promise<StreamTextResult> {
    this.ensureBodhiext();

    let requestHeaders: Record<string, string> = { ...headers };
    if (authenticated) {
      const accessToken = await this._getAccessTokenRaw();
      if (accessToken) {
        requestHeaders = {
          ...requestHeaders,
          Authorization: `Bearer ${accessToken}`,
        };
      }
    }

    const result = await this.bodhiext!.sendStreamText(method, endpoint, body, requestHeaders);

    async function* toAsyncGenerator(stream: ReadableStream<string>): AsyncGenerator<string> {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      status: result.status,
      headers: result.headers,
      body: toAsyncGenerator(result.body),
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
  // Access Request Methods
  // ============================================================================

  async requestAccess(
    body: CreateAccessRequest
  ): Promise<ApiResponse<CreateAccessRequestResponse>> {
    // authenticated=true safely attaches the token when one exists (exchange needs it).
    return this.sendApiRequest<CreateAccessRequest, CreateAccessRequestResponse>(
      'POST',
      '/bodhi/v1/apps/request-access',
      body,
      {},
      true
    );
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
    };
  }
}
