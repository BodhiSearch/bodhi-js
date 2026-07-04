/**
 * DirectClient — concrete, headless DirectClientBase for non-interactive runtimes
 * (Web Workers, servers, tests).
 *
 * It is the runtime API surface of DirectClientBase (init/sendApiRequest/stream/
 * getAuthState/auto-refresh/models/mcps) made instantiable, with:
 * - no interactive login: `login()` throws — inject tokens via `initialTokens` and
 *   bind the server with `init({ serverUrl })`;
 * - a configured (or empty) redirect URI, never read from `window`;
 * - a direct-mode MCP transport (Bearer-injecting `fetch`, no extension bridge).
 *
 * Everything it does uses only `fetch`/`AbortController`/`TextDecoder`/`ReadableStream`
 * + the injected `IStorage`, so it runs anywhere those globals exist.
 */

import { DirectClientBase, type DirectClientBaseConfig } from './direct-client-base';
import { createDirectMcpFetch, type McpTransportConfig } from './mcp-fetch';
import { InMemoryStorage } from './types/storage';
import type { AuthState, IStorage, InitialTokens, LogLevel, StateChangeCallback } from './types';

export interface DirectClientConfig {
  authClientId: string;
  authServerUrl: string;
  /** Optional: pre-bind the server URL so MCP transport works before `init()`. */
  serverUrl?: string;
  /** Returned by `_getRedirectUri()`; unused in headless mode. Defaults to ''. */
  redirectUri?: string;
  storagePrefix?: string;
  logLevel?: LogLevel;
  apiTimeoutMs?: number;
  /** Defaults to a fresh `InMemoryStorage`. */
  storage?: IStorage;
  initialTokens?: InitialTokens;
}

export class DirectClient extends DirectClientBase {
  private _redirectUri: string;

  constructor(config: DirectClientConfig, onStateChange?: StateChangeCallback) {
    const baseConfig: DirectClientBaseConfig = {
      authClientId: config.authClientId,
      authServerUrl: config.authServerUrl,
      storagePrefix: config.storagePrefix ?? 'bodhi-js-sdk:direct',
      logLevel: config.logLevel ?? 'warn',
      loggerPrefix: 'DirectClient',
      apiTimeoutMs: config.apiTimeoutMs,
      storage: config.storage ?? new InMemoryStorage(),
      initialTokens: config.initialTokens,
    };
    super(baseConfig, onStateChange);
    this._redirectUri = config.redirectUri ?? '';

    // Optionally pre-bind serverUrl so createMcpTransportConfig works before init().
    // init({ serverUrl }) still binds/commits the connection and consumes initialTokens.
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
      this.rebuildStorageKeys();
    }
  }

  /**
   * Direct-mode MCP transport: standard fetch with Bearer-token injection
   * (token pulled fresh from getAuthState() so auto-refresh applies).
   */
  createMcpTransportConfig(mcp_path: string): McpTransportConfig {
    const serverUrl = this.serverUrl;
    if (!serverUrl) {
      throw new Error(
        'DirectClient not initialized. Call init({ serverUrl }) before creating an MCP transport.'
      );
    }
    return {
      url: new URL(`${serverUrl}${mcp_path}`),
      fetch: createDirectMcpFetch(async () => {
        const authState = await this.getAuthState();
        return authState.accessToken;
      }),
    };
  }

  login(): Promise<AuthState> {
    return Promise.reject(
      new Error(
        'DirectClient: interactive login is unavailable in a headless/worker context. ' +
          'Perform interactive login on the host, then inject tokens via `initialTokens` and call `init({ serverUrl })`.'
      )
    );
  }

  protected _getRedirectUri(): string {
    return this._redirectUri;
  }
}
