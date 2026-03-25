/**
 * ExtUIClient - Public facade client for extension mode
 *
 * Wraps either DirectClient or ExtClient based on user preferences.
 * Delegates all UIClient methods to the active client instance.
 */

import {
  BaseFacadeClient,
  createStoragePrefixWithBasePath,
  Logger,
  STORAGE_PREFIXES,
  type LogLevel,
  type StateChange,
  type StateChangeCallback,
  type UIClient,
} from '@bodhiapp/bodhi-js-core';
import { DirectExtClient } from './direct-client';
import { ExtClient } from './ext-client';

/**
 * Internal config for ExtUIClient
 * All fields required - facade sets defaults
 */
export interface ExtUIClientConfig {
  authServerUrl: string;
  basePath: string;
  logLevel: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      attempts?: number;
      attemptWaitMs?: number;
      attemptTimeout?: number;
    };
  };
}

/**
 * Optional configuration parameters for ExtUIClient constructor
 * Public type for consumers
 */
export interface ExtUIClientParams {
  authServerUrl?: string;
  basePath?: string;
  logLevel?: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      attempts?: number;
      attemptWaitMs?: number;
      attemptTimeout?: number;
    };
  };
}

/**
 * ExtUIClient - Public facade for extension mode
 *
 * Automatically switches between DirectClient and ExtClient
 * based on stored user preferences.
 */
export class ExtUIClient
  extends BaseFacadeClient<ExtUIClientConfig, ExtClient, DirectExtClient>
  implements UIClient
{
  constructor(
    authClientId: string,
    config?: ExtUIClientParams,
    onStateChange?: StateChangeCallback
  ) {
    // Normalize config with defaults
    const cfg = config || {};
    const normalizedConfig: ExtUIClientConfig = {
      basePath: cfg.basePath || '/',
      authServerUrl: cfg.authServerUrl || 'https://id.getbodhi.app/realms/bodhi',
      logLevel: cfg.logLevel || 'warn',
      apiTimeoutMs: cfg.apiTimeoutMs,
      initParams: cfg.initParams,
    };

    super(authClientId, normalizedConfig, onStateChange);
  }

  protected createLogger(config: ExtUIClientConfig): Logger {
    return new Logger('ExtUIClient', config.logLevel);
  }

  protected createStoragePrefix(config: ExtUIClientConfig): string {
    return createStoragePrefixWithBasePath(config.basePath, STORAGE_PREFIXES.EXT);
  }

  protected createExtClient(
    config: ExtUIClientConfig,
    onStateChange: (change: StateChange) => void
  ): ExtClient {
    return new ExtClient(
      {
        authClientId: this.authClientId,
        logLevel: config.logLevel,
        apiTimeoutMs: config.apiTimeoutMs,
        initParams: config.initParams,
      },
      onStateChange
    );
  }

  protected createDirectClient(
    authClientId: string,
    config: ExtUIClientConfig,
    onStateChange: (change: StateChange) => void
  ): DirectExtClient {
    return new DirectExtClient(
      {
        authClientId,
        authServerUrl: config.authServerUrl,
        logLevel: config.logLevel,
        basePath: config.basePath,
        apiTimeoutMs: config.apiTimeoutMs,
      },
      onStateChange
    );
  }
}
