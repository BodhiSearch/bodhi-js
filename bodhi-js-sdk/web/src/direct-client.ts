/**
 * DirectWebClient - Direct HTTP client for web mode
 *
 * Uses browser redirect OAuth flow with localStorage for token storage.
 */

import {
  AccessRequestBuilder,
  BASE_OAUTH_SCOPE,
  buildAuthorizeUrl,
  buildErrorUrl,
  buildReviewUrl,
  DirectClientBase,
  STORAGE_PREFIXES,
  unwrapResponse,
  createStoragePrefixWithNamespace,
  generateCodeChallenge,
  generateCodeVerifier,
  type AuthState,
  type DirectClientBaseConfig,
  type InitialTokens,
  type IStorage,
  type LoginOptions,
  type LogLevel,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import { LocalStorageAdapter } from './local-storage';

/**
 * Configuration for DirectWebClient
 */
export interface DirectWebClientConfig {
  authClientId: string;
  authServerUrl: string;
  basePath: string;
  logLevel: LogLevel;
  redirectUri: string;
  apiTimeoutMs?: number;
  storage?: IStorage;
  initialTokens?: InitialTokens;
}

/**
 * DirectWebClient - Web mode implementation using browser redirect OAuth
 */
export class DirectWebClient extends DirectClientBase {
  private redirectUri: string;

  constructor(config: DirectWebClientConfig, onStateChange?: StateChangeCallback) {
    const storagePrefix = createStoragePrefixWithNamespace(
      config.basePath,
      STORAGE_PREFIXES.WEB_DIRECT
    );
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      storagePrefix,
      logLevel: config.logLevel,
      loggerPrefix: 'DirectWebClient',
      apiTimeoutMs: config.apiTimeoutMs,
      storage: config.storage ?? new LocalStorageAdapter(),
      initialTokens: config.initialTokens,
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

    const userRole = options?.userRole ?? 'scope_user_user';
    const redirectUri = this.redirectUri;

    options?.onProgress?.('requesting');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();
    await this._storageSet({
      [this.storageKeys.CODE_VERIFIER]: codeVerifier,
      [this.storageKeys.STATE]: state,
    });

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
    const accessRequestResult = await this.requestAccess(builder.build());
    const { review_url: reviewUrl } = unwrapResponse(accessRequestResult);

    options?.onProgress?.('reviewing');
    window.location.href = buildReviewUrl(reviewUrl, authUrl, errorUrl);
    return new Promise(() => {});
  }

  async handleOAuthCallback(code: string, state: string): Promise<AuthState> {
    const storedState = await this._storageGet(this.storageKeys.STATE);
    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    await this.exchangeCodeForTokens(code);

    const authState = await this.getAuthState();

    if (authState.status !== 'authenticated') {
      throw new Error('Login failed');
    }

    this.setAuthState(authState);
    return authState;
  }

  protected _getRedirectUri(): string {
    return this.redirectUri;
  }
}
