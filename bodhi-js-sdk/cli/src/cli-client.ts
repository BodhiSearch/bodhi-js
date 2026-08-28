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
  assertCallbackSuccess,
  BodhiError,
  createDirectMcpFetch,
  DirectClientBase,
  InMemoryStorage,
  performConsentLogin,
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
    // Set base class serverUrl immediately so login() can build the consent URL
    // before init(). Also build the serverUrl-scoped OAuth storage keys now:
    // login() persists CODE_VERIFIER/STATE before init() rebuilds them.
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
   * 2. Build the consent-page URL and call onAuthUrl so host can open browser
   * 3. User approves on the consent page → Keycloak SSO → callback with code
   * 4. Exchange code for tokens, auto-init client
   * 5. Close server and return AuthState
   */
  async login(options?: CliLoginOptions): Promise<AuthState> {
    const callbackPort = options?.callbackPort ?? DEFAULT_CALLBACK_PORT;
    this._callbackPort = callbackPort;
    const callbackUrl = `http://localhost:${callbackPort}/callback`;

    let expectedState: string | null = null;
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

      let code: string;
      try {
        ({ code } = assertCallbackSuccess(url.searchParams, expectedState));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Access request failed</h1><p>${message}</p></body></html>`);
        rejectAuth(error instanceof BodhiError ? error : new Error(message));
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

    try {
      return await performConsentLogin(
        {
          getAuthState: () => this.getAuthState(),
          getServerUrl: async () => this._serverUrl,
          getRedirectUri: () => callbackUrl,
          storePkce: async v => {
            expectedState = v.state;
            await this._storageSet({
              [this.storageKeys.CODE_VERIFIER]: v.codeVerifier,
              [this.storageKeys.STATE]: v.state,
            });
          },
          navigate: consentUrl => {
            options?.onAuthUrl?.(consentUrl);
            return authPromise;
          },
        },
        this.authClientId,
        options
      );
    } finally {
      clearTimeout(loginTimeout);
      server.close();
    }
  }

  protected _getRedirectUri(): string {
    return `http://localhost:${this._callbackPort}/callback`;
  }
}
