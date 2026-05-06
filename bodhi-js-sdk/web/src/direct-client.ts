/**
 * DirectWebClient - Direct HTTP client for web mode
 *
 * Uses browser redirect OAuth flow with localStorage for token storage.
 */

import {
  AccessRequestBuilder,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  DirectClientBase,
  STORAGE_PREFIXES,
  throwAccessRequestDenialError,
  unwrapResponse,
  createStoragePrefixWithNamespace,
  generateCodeChallenge,
  generateCodeVerifier,
  openPopupReview,
  type AuthState,
  type DirectClientBaseConfig,
  type InitialTokens,
  type IStorage,
  type LoginOptions,
  type LogLevel,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import type { AccessRequestStatusResponse } from '@bodhiapp/ts-client';
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
      const redirectUrl = options?.redirectUrl ?? this.redirectUri;
      builder.redirectUrl(redirectUrl);
    }

    const accessRequestBody = builder.build();
    const accessRequestResult = await this.requestAccess(accessRequestBody);

    const { id: requestId, review_url: reviewUrl } = unwrapResponse(accessRequestResult);
    options?.onProgress?.('reviewing');

    let accessRequestScope: string | null | undefined;

    if (flowType === 'popup') {
      // Popup flow: open review popup and poll
      const pollFn = async () => {
        const statusResult = await this.getAccessRequestStatus(requestId);
        if (statusResult.status >= 400) return null;
        const { status, access_request_scope } = statusResult.body as AccessRequestStatusResponse;
        if (status === 'approved')
          return { approved: true, accessRequestScope: access_request_scope ?? undefined };
        if (['denied', 'failed', 'expired'].includes(status)) return { approved: false, status };
        return null; // still pending
      };

      const reviewResult = await openPopupReview(reviewUrl, pollFn, {
        intervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        timeoutMs: options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
      });

      if (!reviewResult.approved) {
        throwAccessRequestDenialError(reviewResult.status ?? 'unknown');
      }
      accessRequestScope = reviewResult.accessRequestScope;
    } else {
      // Redirect flow: store requestId and redirect
      await this._storageSet({ [this.storageKeys.ACCESS_REQUEST_ID]: requestId });
      window.location.href = reviewUrl;
      return new Promise(() => {}); // never resolves
    }

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

    const authUrl = new URL(this.authEndpoints.authorize);
    authUrl.searchParams.set('client_id', this.authClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
    throw new Error('Redirect initiated');
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

  async handleAccessRequestCallback(requestId: string): Promise<AuthState> {
    const statusResult = await this.getAccessRequestStatus(requestId);
    const { status, access_request_scope } = unwrapResponse(statusResult);
    // Clean up storage on ALL paths (not just success)
    await this._storageRemove([this.storageKeys.ACCESS_REQUEST_ID]);
    if (status !== 'approved') throwAccessRequestDenialError(status);
    const scope = `openid profile email roles ${access_request_scope ?? ''}`.trim();
    return this.performOAuthPkce(scope);
  }

  protected _getRedirectUri(): string {
    return this.redirectUri;
  }
}
