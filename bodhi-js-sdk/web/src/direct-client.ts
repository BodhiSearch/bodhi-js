/**
 * DirectWebClient - Direct HTTP client for web mode
 *
 * Uses browser redirect OAuth flow with localStorage for token storage.
 */

import {
  DirectClientBase,
  STORAGE_PREFIXES,
  createOperationError,
  createStoragePrefixWithBasePath,
  generateCodeChallenge,
  generateCodeVerifier,
  getMissingToolsetScopeIds,
  getRequestedToolsetScopes,
  isApiResultError,
  isApiResultOperationError,
  isApiResultSuccess,
  type AuthState,
  type DirectClientBaseConfig,
  type LoginOptions,
  type LogLevel,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';

/**
 * Configuration for DirectWebClient
 */
export interface DirectWebClientConfig {
  authClientId: string;
  authServerUrl: string;
  userScope: string;
  basePath: string;
  logLevel: LogLevel;
  redirectUri: string;
  apiTimeoutMs?: number;
}

/**
 * DirectWebClient - Web mode implementation using browser redirect OAuth
 */
export class DirectWebClient extends DirectClientBase {
  private redirectUri: string;

  constructor(config: DirectWebClientConfig, onStateChange?: StateChangeCallback) {
    const storagePrefix = createStoragePrefixWithBasePath(
      config.basePath,
      STORAGE_PREFIXES.WEB_DIRECT
    );
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      userScope: config.userScope,
      storagePrefix,
      logLevel: config.logLevel,
      loggerPrefix: 'DirectWebClient',
      apiTimeoutMs: config.apiTimeoutMs,
    };
    super(baseConfig, onStateChange);
    this.redirectUri = config.redirectUri;
  }

  // ============================================================================
  // Authentication (Browser Redirect OAuth)
  // ============================================================================

  async login(options?: LoginOptions): Promise<AuthState> {
    const existingAuth = await this.getAuthState();
    if (existingAuth.status === 'authenticated') {
      return existingAuth;
    }

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
    const toolsetScopes = getRequestedToolsetScopes(options?.toolsetScopeIds, toolsets);

    const fullScope =
      `openid profile email roles ${this.userScope} ${resourceScope} ${toolsetScopes}`.trim();

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();

    localStorage.setItem(this.storageKeys.CODE_VERIFIER, codeVerifier);
    localStorage.setItem(this.storageKeys.STATE, state);

    const authUrl = new URL(this.authEndpoints.authorize);
    authUrl.searchParams.set('client_id', this.authClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', fullScope);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
    // Note: This line is never reached due to redirect, but TypeScript requires a return
    throw new Error('Redirect initiated');
  }

  async handleOAuthCallback(code: string, state: string): Promise<AuthState> {
    const storedState = localStorage.getItem(this.storageKeys.STATE);
    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    await this.exchangeCodeForTokens(code);

    localStorage.removeItem(this.storageKeys.CODE_VERIFIER);
    localStorage.removeItem(this.storageKeys.STATE);

    const authState = await this.getAuthState();

    if (authState.status !== 'authenticated') {
      throw new Error('Login failed');
    }

    this.setAuthState(authState);
    return authState;
  }

  async logout(): Promise<AuthState> {
    const refreshToken = localStorage.getItem(this.storageKeys.REFRESH_TOKEN);

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

    localStorage.removeItem(this.storageKeys.ACCESS_TOKEN);
    localStorage.removeItem(this.storageKeys.REFRESH_TOKEN);
    localStorage.removeItem(this.storageKeys.EXPIRES_AT);
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

  // ============================================================================
  // OAuth Helper Methods
  // ============================================================================

  protected async exchangeCodeForTokens(code: string): Promise<void> {
    const codeVerifier = localStorage.getItem(this.storageKeys.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const response = await fetch(this.authEndpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.authClientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();

    localStorage.setItem(this.storageKeys.ACCESS_TOKEN, tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem(this.storageKeys.REFRESH_TOKEN, tokens.refresh_token);
    }

    if (tokens.expires_in) {
      const expiresAt = Date.now() + tokens.expires_in * 1000;
      localStorage.setItem(this.storageKeys.EXPIRES_AT, expiresAt.toString());
    }
  }

  // ============================================================================
  // Storage Implementation (localStorage)
  // ============================================================================

  protected async _storageGet(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  protected async _storageSet(items: Record<string, string | number>): Promise<void> {
    Object.entries(items).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });
  }

  protected async _storageRemove(keys: string[]): Promise<void> {
    keys.forEach((key) => localStorage.removeItem(key));
  }

  protected _getRedirectUri(): string {
    return this.redirectUri;
  }
}
