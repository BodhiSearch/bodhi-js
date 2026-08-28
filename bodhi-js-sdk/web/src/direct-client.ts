/**
 * DirectWebClient - Direct HTTP client for web mode
 *
 * Uses browser redirect OAuth flow with localStorage for token storage.
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
        getRedirectUri: () => this.redirectUri,
        storePkce: (v) =>
          this._storageSet({
            [this.storageKeys.CODE_VERIFIER]: v.codeVerifier,
            [this.storageKeys.STATE]: v.state,
          }),
        navigate: (consentUrl) => {
          window.location.href = consentUrl;
          return new Promise(() => {});
        },
      },
      this.authClientId,
      options
    );
  }

  async handleOAuthCallback(params: URLSearchParams): Promise<AuthState> {
    const storedState = await this._storageGet(this.storageKeys.STATE);
    let code: string;
    try {
      ({ code } = assertCallbackSuccess(params, storedState));
    } catch (error) {
      await this._storageRemove([this.storageKeys.CODE_VERIFIER, this.storageKeys.STATE]);
      throw error;
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
