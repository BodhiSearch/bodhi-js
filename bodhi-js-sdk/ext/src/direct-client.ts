/**
 * DirectExtClient - Direct HTTP client for extension mode
 *
 * Uses chrome.identity.launchWebAuthFlow for OAuth with chrome.storage.session for token storage.
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
 * Configuration for DirectExtClient
 */
export interface DirectExtClientConfig {
  authClientId: string;
  authServerUrl: string;
  userScope: string;
  basePath: string;
  logLevel: LogLevel;
  apiTimeoutMs?: number;
}

/**
 * DirectExtClient - Extension mode implementation using chrome.identity OAuth
 */
export class DirectExtClient extends DirectClientBase {
  constructor(config: DirectExtClientConfig, onStateChange?: StateChangeCallback) {
    const storagePrefix = createStoragePrefixWithBasePath(
      config.basePath,
      STORAGE_PREFIXES.EXT_DIRECT
    );
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      userScope: config.userScope,
      storagePrefix,
      logLevel: config.logLevel,
      loggerPrefix: 'DirectExtClient',
      apiTimeoutMs: config.apiTimeoutMs,
    };
    super(baseConfig, onStateChange);
  }

  // ============================================================================
  // Authentication (chrome.identity OAuth)
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
    await chrome.storage.session.set({ [this.storageKeys.RESOURCE_SCOPE]: resourceScope });

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

    await chrome.storage.session.set({
      [this.storageKeys.CODE_VERIFIER]: codeVerifier,
      [this.storageKeys.STATE]: state,
    });

    const redirectUri = chrome.identity.getRedirectURL('callback');
    const authUrl = new URL(this.authEndpoints.authorize);
    authUrl.searchParams.set('client_id', this.authClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', fullScope);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError) {
            await chrome.storage.session.remove([
              this.storageKeys.CODE_VERIFIER,
              this.storageKeys.STATE,
            ]);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!redirectUrl) {
            await chrome.storage.session.remove([
              this.storageKeys.CODE_VERIFIER,
              this.storageKeys.STATE,
            ]);
            reject(createOperationError('No redirect URL received', 'oauth-error'));
            return;
          }

          try {
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');

            const data = await chrome.storage.session.get(this.storageKeys.STATE);
            const savedState = data[this.storageKeys.STATE];
            if (returnedState !== savedState) {
              await chrome.storage.session.remove([
                this.storageKeys.CODE_VERIFIER,
                this.storageKeys.STATE,
              ]);
              reject(createOperationError('State mismatch - possible CSRF', 'oauth-error'));
              return;
            }

            if (!code) {
              await chrome.storage.session.remove([
                this.storageKeys.CODE_VERIFIER,
                this.storageKeys.STATE,
              ]);
              reject(createOperationError('No authorization code received', 'oauth-error'));
              return;
            }

            await this.exchangeCodeForTokens(code);

            const authState = await this.getAuthState();

            if (authState.status !== 'authenticated') {
              throw createOperationError('Login failed', 'oauth-error');
            }

            this.setAuthState(authState);
            await chrome.storage.session.remove([
              this.storageKeys.CODE_VERIFIER,
              this.storageKeys.STATE,
            ]);
            resolve(authState);
          } catch (error) {
            await chrome.storage.session.remove([
              this.storageKeys.CODE_VERIFIER,
              this.storageKeys.STATE,
            ]);
            reject(error);
          }
        }
      );
    });
  }

  async logout(): Promise<AuthState> {
    const data = await chrome.storage.session.get(this.storageKeys.REFRESH_TOKEN);
    const refreshToken = data[this.storageKeys.REFRESH_TOKEN];

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

    await chrome.storage.session.remove([
      this.storageKeys.ACCESS_TOKEN,
      this.storageKeys.REFRESH_TOKEN,
      this.storageKeys.EXPIRES_AT,
      this.storageKeys.RESOURCE_SCOPE,
    ]);

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
    const data = await chrome.storage.session.get(this.storageKeys.CODE_VERIFIER);
    const codeVerifier = data[this.storageKeys.CODE_VERIFIER];
    const redirectUri = chrome.identity.getRedirectURL('callback');

    const response = await fetch(this.authEndpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

    await chrome.storage.session.set({
      [this.storageKeys.ACCESS_TOKEN]: tokens.access_token,
      [this.storageKeys.REFRESH_TOKEN]: tokens.refresh_token,
      [this.storageKeys.EXPIRES_AT]: expiresAt,
    });

    await chrome.storage.session.remove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
  }

  // ============================================================================
  // Storage Implementation (chrome.storage.session)
  // ============================================================================

  protected async _storageGet(key: string): Promise<string | null> {
    const data = await chrome.storage.session.get(key);
    const value = data[key];
    return value !== undefined ? String(value) : null;
  }

  protected async _storageSet(items: Record<string, string | number>): Promise<void> {
    await chrome.storage.session.set(items);
  }

  protected async _storageRemove(keys: string[]): Promise<void> {
    await chrome.storage.session.remove(keys);
  }

  protected _getRedirectUri(): string {
    return chrome.identity.getRedirectURL('callback');
  }
}
