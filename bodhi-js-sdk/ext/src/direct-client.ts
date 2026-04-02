/**
 * DirectExtClient - Direct HTTP client for extension mode
 *
 * Uses chrome.identity.launchWebAuthFlow for OAuth with chrome.storage.session for token storage.
 */

import {
  AccessRequestBuilder,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  DirectClientBase,
  STORAGE_PREFIXES,
  createOperationError,
  createStoragePrefixWithBasePath,
  generateCodeChallenge,
  generateCodeVerifier,
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
    const storagePrefix = createStoragePrefixWithBasePath(
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

    if (options?.flowType === 'redirect') {
      this.logger.warn('Extension mode does not support redirect flow type; using popup instead');
    }

    const userRole = options?.userRole ?? 'scope_user_user';

    options?.onProgress?.('requesting');
    const builder = new AccessRequestBuilder(this.authClientId)
      .requestedRole(userRole)
      .flowType('popup');

    if (options?.requested) {
      builder.requested(options.requested);
    }

    const accessRequestBody = builder.build();
    // sendApiRequest throws BodhiError on operational errors
    const accessRequestResult = await this.requestAccess(accessRequestBody);

    const { id: requestId, review_url: reviewUrl } = unwrapResponse(accessRequestResult);
    options?.onProgress?.('reviewing');

    // Open review URL in a new tab
    await chrome.tabs.create({ url: reviewUrl });

    // Poll for approval
    const statusResponse = await this.pollAccessRequestStatus(requestId, {
      intervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      timeoutMs: options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
    });

    if (statusResponse.status !== 'approved') {
      throw createOperationError('auth_error', `Access request ${statusResponse.status}`);
    }

    const accessRequestScope = statusResponse.access_request_scope;
    options?.onProgress?.('authenticating');

    return this.performOAuthPkce(`openid profile email roles ${accessRequestScope ?? ''}`.trim());
  }

  protected async performOAuthPkce(scope: string): Promise<AuthState> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();

    await this._storageSet({
      [this.storageKeys.CODE_VERIFIER]: codeVerifier,
      [this.storageKeys.STATE]: state,
    });

    const redirectUri = chrome.identity.getRedirectURL('callback');
    const authUrl = new URL(this.authEndpoints.authorize);
    authUrl.searchParams.set('client_id', this.authClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        async (redirectUrl) => {
          if (chrome.runtime.lastError) {
            await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
            reject(chrome.runtime.lastError);
            return;
          }
          if (!redirectUrl) {
            await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
            reject(createOperationError('oauth_error', 'No redirect URL received'));
            return;
          }
          try {
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const storedState = await this._storageGet(this.storageKeys.STATE);
            if (returnedState !== storedState) {
              await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
              reject(createOperationError('oauth_error', 'State mismatch'));
              return;
            }
            if (!code) {
              await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
              reject(createOperationError('oauth_error', 'No authorization code'));
              return;
            }
            await this.exchangeCodeForTokens(code);
            const authState = await this.getAuthState();
            if (authState.status !== 'authenticated') {
              throw createOperationError('oauth_error', 'Login failed');
            }
            this.setAuthState(authState);
            await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
            resolve(authState);
          } catch (error) {
            await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
            reject(error);
          }
        }
      );
    });
  }

  protected _getRedirectUri(): string {
    return chrome.identity.getRedirectURL('callback');
  }
}
