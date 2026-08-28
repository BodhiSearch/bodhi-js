/**
 * DirectExtClient - Direct HTTP client for extension mode
 *
 * Uses chrome.identity.launchWebAuthFlow for OAuth with chrome.storage.session for token storage.
 */

import {
  assertCallbackSuccess,
  createOperationError,
  createStoragePrefixWithNamespace,
  DirectClientBase,
  performConsentLogin,
  STORAGE_PREFIXES,
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
    return performConsentLogin(
      {
        getAuthState: () => this.getAuthState(),
        getServerUrl: async () => {
          if (!this.serverUrl) {
            throw createOperationError(
              'access_request_failed',
              'Bodhi server URL not set — call init() with a server URL before login()'
            );
          }
          return this.serverUrl;
        },
        getRedirectUri: () => this._getRedirectUri(),
        storePkce: (v) =>
          this._storageSet({
            [this.storageKeys.CODE_VERIFIER]: v.codeVerifier,
            [this.storageKeys.STATE]: v.state,
          }),
        navigate: async (consentUrl) => {
          const redirectUrl = await this.launchReview(consentUrl);
          options?.onProgress?.('authenticating');
          return this.completeOAuthRedirect(redirectUrl);
        },
      },
      this.authClientId,
      options
    );
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
    const storedState = await this._storageGet(this.storageKeys.STATE);
    let code: string;
    try {
      ({ code } = assertCallbackSuccess(url.searchParams, storedState));
    } catch (error) {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      throw error;
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
