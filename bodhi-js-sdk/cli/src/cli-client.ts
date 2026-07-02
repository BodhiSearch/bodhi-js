/**
 * CliClient — headless/CLI client for Bodhi Browser SDK
 *
 * Extends DirectClientBase with:
 * - serverUrl in config (not init params)
 * - login() with full OAuth flow (callback server + access request + PKCE)
 * - Simplified init() (no-args, uses stored serverUrl)
 */

import http from 'node:http';
import { URL } from 'node:url';
import {
  AccessRequestBuilder,
  BASE_OAUTH_SCOPE,
  buildAuthorizeUrl,
  buildErrorUrl,
  buildReviewUrl,
  createOperationError,
  DirectClientBase,
  generateCodeChallenge,
  generateCodeVerifier,
  InMemoryStorage,
  unwrapResponse,
  createDirectMcpFetch,
  type AuthState,
  type DirectClientBaseConfig,
  type DirectState,
  type McpTransportConfig,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import type { CliClientConfig, CliLoginOptions } from './types';

const DEFAULT_CALLBACK_PORT = 5173;

export class CliClient extends DirectClientBase {
  private _serverUrl: string;
  private _callbackPort: number = DEFAULT_CALLBACK_PORT;

  constructor(config: CliClientConfig, onStateChange?: StateChangeCallback) {
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      storagePrefix: config.storagePrefix ?? 'bodhi-js-sdk:cli:direct',
      logLevel: config.logLevel ?? 'warn',
      loggerPrefix: 'CliClient',
      apiTimeoutMs: config.apiTimeoutMs,
      storage: config.storage ?? new InMemoryStorage(),
      initialTokens: config.initialTokens,
    };
    super(baseConfig, onStateChange);
    this._serverUrl = config.serverUrl;
    // Set base class serverUrl immediately so sendApiRequest works before init()
    // (login() calls requestAccess which uses sendApiRequest). Also build the
    // serverUrl-scoped OAuth storage keys now: login() persists CODE_VERIFIER/STATE
    // during the access-request callback, which runs before init() rebuilds them.
    this.serverUrl = config.serverUrl;
    this.rebuildStorageKeys();
  }

  /**
   * Simplified init — uses stored serverUrl, always tests connection.
   */
  async init(): Promise<DirectState> {
    return super.init({
      serverUrl: this._serverUrl,
      selectedConnection: true,
      testConnection: true,
    });
  }

  /**
   * Create MCP transport config for StreamableHTTPClientTransport.
   * CLI is always direct mode — uses standard fetch with Bearer token injection.
   */
  createMcpTransportConfig(mcp_path: string): McpTransportConfig {
    return {
      url: new URL(`${this._serverUrl}${mcp_path}`),
      fetch: createDirectMcpFetch(async () => {
        const authState = await this.getAuthState();
        return authState.accessToken;
      }),
    };
  }

  /**
   * Full CLI OAuth login flow:
   * 1. Start localhost callback server
   * 2. Create access request (with redirect to callback)
   * 3. Call onReviewUrl so host can open browser
   * 4. Wait for approval redirect → 302 to Keycloak PKCE
   * 5. Wait for Keycloak callback → exchange code for tokens
   * 6. Auto-init client
   * 7. Close server and return AuthState
   */
  async login(options?: CliLoginOptions): Promise<AuthState> {
    const callbackPort = options?.callbackPort ?? DEFAULT_CALLBACK_PORT;
    this._callbackPort = callbackPort;
    const callbackUrl = `http://localhost:${callbackPort}/callback`;

    const userRole = options?.userRole ?? 'scope_user_user';
    const requested = options?.requested;
    const onReviewUrl = options?.onReviewUrl;

    // Keycloak returns the code to this local server; the review page redirects here with
    // ?bodhi_flow=access_request_error on deny/failure.
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const pkceState = generateCodeVerifier();
    await this._storageSet({
      [this.storageKeys.CODE_VERIFIER]: codeVerifier,
      [this.storageKeys.STATE]: pkceState,
    });

    const authUrl = buildAuthorizeUrl(this.authEndpoints, {
      clientId: this.authClientId,
      redirectUri: callbackUrl,
      scope: BASE_OAUTH_SCOPE,
      state: pkceState,
      codeChallenge,
    });
    const errorUrl = buildErrorUrl(callbackUrl);

    let resolveAuth: (state: AuthState) => void;
    let rejectAuth: (err: Error) => void;
    const authPromise = new Promise<AuthState>((resolve, reject) => {
      resolveAuth = resolve;
      rejectAuth = reject;
    });

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${callbackPort}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        const description = url.searchParams.get('error_description') ?? error;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Access request ${error}</h1><p>${description}</p></body></html>`);
        const code = error === 'access_denied' ? 'access_request_denied' : 'access_request_failed';
        rejectAuth(createOperationError(code, description));
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state || state !== pkceState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Invalid callback</h1></body></html>');
        rejectAuth(new Error('Invalid callback parameters'));
        return;
      }

      try {
        await this.exchangeCodeForTokens(code);
        await this.init();
        const authState = await this.getAuthState();
        this.setAuthState(authState);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Login successful</h1><p>You can close this window.</p></body></html>');
        resolveAuth(authState);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Login failed</h1><p>${error}</p></body></html>`);
        rejectAuth(error instanceof Error ? error : new Error(String(error)));
      }
    });

    server.listen(callbackPort, '127.0.0.1');

    const loginTimeoutMs = options?.loginTimeoutMs ?? 300_000;
    const loginTimeout = setTimeout(() => {
      server.close();
      rejectAuth(new Error(`Login timed out after ${loginTimeoutMs}ms. User did not complete the browser flow.`));
    }, loginTimeoutMs);

    const builder = new AccessRequestBuilder(this.authClientId).requestedRole(userRole);
    if (requested) {
      builder.requested(requested);
    }
    const accessResult = await this.requestAccess(builder.build());
    const { review_url } = unwrapResponse(accessResult);
    onReviewUrl?.(buildReviewUrl(review_url, authUrl, errorUrl));

    try {
      const authState = await authPromise;
      return authState;
    } finally {
      clearTimeout(loginTimeout);
      server.close();
    }
  }

  protected _getRedirectUri(): string {
    return `http://localhost:${this._callbackPort}/callback`;
  }
}
