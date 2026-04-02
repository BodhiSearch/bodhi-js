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
    // (login() calls requestAccess which uses sendApiRequest)
    this.serverUrl = config.serverUrl;
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

    // State across callback phases (assigned after handler is defined, read when callback fires)
    let accessRequestId: string;
    let codeVerifier: string;
    let pkceState: string;

    let resolveAuth: (state: AuthState) => void;
    let rejectAuth: (err: Error) => void;
    const authPromise = new Promise<AuthState>((resolve, reject) => {
      resolveAuth = resolve;
      rejectAuth = reject;
    });

    // --- Callback server ---
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${callbackPort}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const flowType = url.searchParams.get('flow_type');

      if (flowType === 'access_request') {
        // Access request approved → redirect to Keycloak PKCE auth
        try {
          const statusResult = await this.getAccessRequestStatus(accessRequestId);
          const { status, access_request_scope } = unwrapResponse(statusResult);

          if (status !== 'approved') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Access Request ${status}</h1></body></html>`);
            rejectAuth(new Error(`Access request ${status}`));
            return;
          }

          const scope = `openid profile email roles ${access_request_scope ?? ''}`.trim();

          // Generate PKCE
          codeVerifier = generateCodeVerifier();
          const codeChallenge = await generateCodeChallenge(codeVerifier);
          pkceState = generateCodeVerifier();

          // Store PKCE state in storage (for exchangeCodeForTokens)
          await this._storageSet({
            [this.storageKeys.CODE_VERIFIER]: codeVerifier,
            [this.storageKeys.STATE]: pkceState,
          });

          // Build Keycloak auth URL
          const authUrlObj = new URL(this.authEndpoints.authorize);
          authUrlObj.searchParams.set('client_id', this.authClientId);
          authUrlObj.searchParams.set('response_type', 'code');
          authUrlObj.searchParams.set('redirect_uri', callbackUrl);
          authUrlObj.searchParams.set('scope', scope);
          authUrlObj.searchParams.set('code_challenge', codeChallenge);
          authUrlObj.searchParams.set('code_challenge_method', 'S256');
          authUrlObj.searchParams.set('state', pkceState);

          // Redirect browser to Keycloak (SSO auto-login after access request)
          res.writeHead(302, { Location: authUrlObj.toString() });
          res.end();
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Error</h1><p>${error}</p></body></html>`);
          rejectAuth(error instanceof Error ? error : new Error(String(error)));
        }
      } else {
        // Keycloak OAuth callback → exchange code for tokens
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || !state || state !== pkceState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid callback</h1></body></html>');
          rejectAuth(new Error('Invalid callback parameters'));
          return;
        }

        try {
          // Use inherited exchangeCodeForTokens (reads CODE_VERIFIER from storage)
          await this.exchangeCodeForTokens(code);

          // Auto-init with server connection test
          await this.init();

          // Fire auth state callback (so host can persist tokens)
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
      }
    });

    server.listen(callbackPort, '127.0.0.1');

    const loginTimeoutMs = options?.loginTimeoutMs ?? 300_000;
    const loginTimeout = setTimeout(() => {
      server.close();
      rejectAuth(new Error(`Login timed out after ${loginTimeoutMs}ms. User did not complete the browser flow.`));
    }, loginTimeoutMs);

    // --- Create access request ---
    const builder = new AccessRequestBuilder(this.authClientId).requestedRole(userRole).flowType('redirect').redirectUrl(`${callbackUrl}?flow_type=access_request`);

    if (requested) {
      builder.requested(requested);
    }

    const requestBody = builder.build();
    const accessResult = await this.requestAccess(requestBody);
    const { id, review_url } = unwrapResponse(accessResult);
    accessRequestId = id;

    onReviewUrl?.(review_url);

    // Wait for auth to complete
    try {
      const authState = await authPromise;
      return authState;
    } finally {
      clearTimeout(loginTimeout);
      server.close();
    }
  }

  /**
   * Not used — CLI handles OAuth via login() callback server flow.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async performOAuthPkce(_scope: string): Promise<AuthState> {
    throw new Error('performOAuthPkce is not supported in CLI mode. Use login() instead.');
  }

  protected _getRedirectUri(): string {
    return `http://localhost:${this._callbackPort}/callback`;
  }
}
