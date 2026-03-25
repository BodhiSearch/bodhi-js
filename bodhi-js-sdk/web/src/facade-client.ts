/**
 * WebUIClient - Public facade client for web mode
 *
 * Wraps either DirectClient or InternalWebUIClient based on user preferences.
 * Delegates all UIClient methods to the active client instance.
 */

import {
  BaseFacadeClient,
  createStoragePrefixWithBasePath,
  Logger,
  STORAGE_PREFIXES,
  type AuthState,
  type IWebUIClient,
  type LogLevel,
  type StateChange,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import { DirectWebClient } from './direct-client';
import { WindowBodhiextClient } from './ext-client';

/**
 * Configuration for WebClient OAuth
 * Internal config - all fields required (facade sets defaults)
 */
export interface WebClientConfig {
  authServerUrl: string;
  redirectUri: string;
  basePath: string;
  logLevel: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      intervalMs?: number;
    };
  };
}

/**
 * Optional configuration parameters for WebUIClient constructor
 * Public type for consumers
 */
export interface WebUIClientParams {
  redirectUri?: string;
  authServerUrl?: string;
  basePath?: string;
  logLevel?: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      intervalMs?: number;
    };
  };
}

/**
 * Compute default redirectUri from basePath
 * @param basePath - Base path for the application
 * @returns Computed redirectUri: ${window.location.origin}${basePath}/callback
 */
function computeDefaultRedirectUri(basePath: string): string {
  if (typeof window === 'undefined') {
    throw new Error('redirectUri required in non-browser environment');
  }
  // Normalize basePath: '/' -> '', '/app/' -> '/app', '/app' -> '/app'
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${window.location.origin}${normalizedBasePath}/callback`;
}

/**
 * WebUIClient - Public facade for web mode
 *
 * Automatically switches between DirectClient and InternalWebUIClient
 * based on stored user preferences.
 */
export class WebUIClient
  extends BaseFacadeClient<WebClientConfig, WindowBodhiextClient, DirectWebClient>
  implements IWebUIClient
{
  constructor(
    authClientId: string,
    config?: WebUIClientParams,
    onStateChange?: StateChangeCallback
  ) {
    // Normalize config with defaults
    const cfg = config || {};
    const normalizedConfig: WebClientConfig = {
      basePath: cfg.basePath || '/',
      redirectUri: cfg.redirectUri || computeDefaultRedirectUri(cfg.basePath || '/'),
      authServerUrl: cfg.authServerUrl || 'https://id.getbodhi.app/realms/bodhi',
      logLevel: cfg.logLevel || 'warn',
      apiTimeoutMs: cfg.apiTimeoutMs,
      initParams: cfg.initParams,
    };

    super(authClientId, normalizedConfig, onStateChange);
  }

  protected createLogger(config: WebClientConfig): Logger {
    return new Logger('WebUIClient', config.logLevel);
  }

  protected createStoragePrefix(config: WebClientConfig): string {
    return createStoragePrefixWithBasePath(config.basePath, STORAGE_PREFIXES.WEB);
  }

  protected createExtClient(
    config: WebClientConfig,
    onStateChange: (change: StateChange) => void
  ): WindowBodhiextClient {
    return new WindowBodhiextClient(
      this.authClientId,
      {
        authServerUrl: config.authServerUrl,
        redirectUri: config.redirectUri,
        basePath: config.basePath,
        logLevel: config.logLevel,
        apiTimeoutMs: config.apiTimeoutMs,
        initParams: config.initParams,
      },
      onStateChange
    );
  }

  protected createDirectClient(
    authClientId: string,
    config: WebClientConfig,
    onStateChange: (change: StateChange) => void
  ): DirectWebClient {
    return new DirectWebClient(
      {
        authClientId,
        authServerUrl: config.authServerUrl,
        redirectUri: config.redirectUri,
        logLevel: config.logLevel,
        basePath: config.basePath,
        apiTimeoutMs: config.apiTimeoutMs,
      },
      onStateChange
    );
  }

  // ============================================================================
  // Web-specific OAuth Callback
  // ============================================================================
  async handleOAuthCallback(code: string, state: string): Promise<AuthState> {
    // Delegate to active client based on connection mode
    if (this.connectionMode === 'direct') {
      return this.directClient.handleOAuthCallback(code, state);
    }
    return this.extClient.handleOAuthCallback(code, state);
  }

  async handleAccessRequestCallback(requestId: string): Promise<AuthState> {
    // Delegate to active client based on connection mode
    if (this.connectionMode === 'direct') {
      return this.directClient.handleAccessRequestCallback(requestId);
    }
    return this.extClient.handleAccessRequestCallback(requestId);
  }
}
