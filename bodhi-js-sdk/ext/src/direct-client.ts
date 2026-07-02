/**
 * DirectExtClient - Direct HTTP client for extension mode
 *
 * Uses chrome.identity.launchWebAuthFlow for OAuth with chrome.storage.session for token storage.
 */

import {
  AccessRequestBuilder,
  BASE_OAUTH_SCOPE,
  buildAuthorizeUrl,
  buildErrorUrl,
  buildReviewUrl,
  DirectClientBase,
  STORAGE_PREFIXES,
  createOperationError,
  createStoragePrefixWithNamespace,
  generateCodeChallenge,
  generateCodeVerifier,
  throwAccessRequestDenialError,
  unwrapResponse,
  type AuthState,
  type DirectClientBaseConfig,
  type IStorage,
  type InitialTokens,
  type LoginOptions,
  type LogLevel,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import { ChromeSessionStorageAdapter } from './chrome-storage';

/**
 * Configuration for DirectExtClient
 */
export interface DirectExtClientConfig {
  authClientId: string;
  authServerUrl: string;
  basePath: string;
  logLevel: LogLevel;
  apiTimeoutMs?: number;
  storage?: IStorage;
  initialTokens?: InitialTokens;
}

/**
 * DirectExtClient - Extension mode implementation using chrome.identity OAuth
 */
export class DirectExtClient extends DirectClientBase {
  constructor(config: DirectExtClientConfig, onStateChange?: StateChangeCallback) {
    const storagePrefix = createStoragePrefixWithNamespace(
      config.basePath,
      STORAGE_PREFIXES.EXT_DIRECT
    );
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      storagePrefix,
      logLevel: config.logLevel,
      loggerPrefix: 'DirectExtClient',
      apiTimeoutMs: config.apiTimeoutMs,
      storage: config.storage ?? new ChromeSessionStorageAdapter(),
      initialTokens: config.initialTokens,
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

    const userRole = options?.userRole ?? 'scope_user_user';
    const redirectUri = this._getRedirectUri();

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
    const target = buildReviewUrl(reviewUrl, authUrl, errorUrl);

    options?.onProgress?.('reviewing');
    const redirectUrl = await this.launchReview(target);
    options?.onProgress?.('authenticating');
    return this.completeOAuthRedirect(redirectUrl);
  }

  private launchReview(target: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: target, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (!redirectUrl) {
          reject(createOperationError('oauth_error', 'No redirect URL received'));
          return;
        }
        resolve(redirectUrl);
      });
    });
  }

  private async completeOAuthRedirect(redirectUrl: string): Promise<AuthState> {
    const url = new URL(redirectUrl);
    const error = url.searchParams.get('error');
    if (error) {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      if (url.searchParams.get('error_source') === 'bodhi') {
        throwAccessRequestDenialError(error === 'access_denied' ? 'denied' : error);
      }
      throw createOperationError('oauth_error', url.searchParams.get('error_description') ?? error);
    }

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const storedState = await this._storageGet(this.storageKeys.STATE);
    if (!returnedState || returnedState !== storedState) {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      throw createOperationError('oauth_error', 'State mismatch');
    }
    if (!code) {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      throw createOperationError('oauth_error', 'No authorization code');
    }

    await this.exchangeCodeForTokens(code);
    const authState = await this.getAuthState();
    if (authState.status !== 'authenticated') {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      throw createOperationError('oauth_error', 'Login failed');
    }
    this.setAuthState(authState);
    return authState;
  }

  protected _getRedirectUri(): string {
    return chrome.identity.getRedirectURL('callback');
  }
}
