import type { IStorage, InitialTokens, LogLevel } from '@bodhiapp/bodhi-js-core';
import type { UserScope } from '@bodhiapp/bodhi-js-core/api';

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
  /** Port for the localhost OAuth callback server (default: 5173) */
  callbackPort?: number;
  /** Role ceiling requested from the consent page (absent → user) */
  role?: UserScope;
  /** LLMs section flag: undefined → server default, true → requested, false → suppressed */
  llms?: boolean;
  /** MCPs section flag; same semantics as llms */
  mcps?: boolean;
  /** Re-consent with prefill from the current grant (reads the access_request_id claim) */
  reauthorize?: boolean;
  /** Additional scope tokens forwarded verbatim to Keycloak (passthrough) */
  extraScopes?: string[];
  /** Called with the consent-page URL — host should open in browser or print to stdout */
  onAuthUrl?: (url: string) => void;
  /** Timeout for the entire login flow in ms (default: 5 minutes) */
  loginTimeoutMs?: number;
}
