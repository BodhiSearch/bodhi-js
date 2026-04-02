import type { IStorage, InitialTokens, LogLevel, UserScope } from '@bodhiapp/bodhi-js-core';
import type { RequestedResourcesV1 } from '@bodhiapp/ts-client';

/**
 * Configuration for CliClient
 */
export interface CliClientConfig {
  /** OAuth app client ID (registered in Keycloak) */
  authClientId: string;
  /** Keycloak realm URL (e.g., 'https://id.getbodhi.app/realms/bodhi') */
  authServerUrl: string;
  /** Bodhi server URL (e.g., 'http://localhost:1135') */
  serverUrl: string;
  /** Storage adapter (default: InMemoryStorage) */
  storage?: IStorage;
  /** Pre-existing tokens to inject (from file, env, etc.) */
  initialTokens?: InitialTokens;
  /** Log level (default: 'warn') */
  logLevel?: LogLevel;
  /** Storage key prefix (default: 'bodhi-js-sdk:cli:direct') */
  storagePrefix?: string;
  /** API request timeout in ms */
  apiTimeoutMs?: number;
}

/**
 * Options for CliClient.login()
 */
export interface CliLoginOptions {
  /** Port for the localhost OAuth callback server (default: 7173) */
  callbackPort?: number;
  /** Requested user role (default: 'scope_user_user') */
  userRole?: UserScope;
  /** Requested resources (MCP servers, etc.) */
  requested?: RequestedResourcesV1;
  /** Called with the access request review URL — host should open in browser or print to stdout */
  onReviewUrl?: (url: string) => void;
  /** Timeout for the entire login flow in ms (default: 5 minutes) */
  loginTimeoutMs?: number;
}
