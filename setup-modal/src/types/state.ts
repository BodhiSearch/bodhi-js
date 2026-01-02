import type { Browser, EnvState, OS } from './platform';
import type { ExtensionState } from './extension';
import type { ServerState } from './server';
import type { LnaServerState, LnaState } from './lna';

// Step enum for navigation
export enum SetupStep {
  PLATFORM_CHECK = 'platform-check',
  SERVER_SETUP = 'server-setup',
  LNA_SETUP = 'lna-setup',
  EXTENSION_SETUP = 'extension-setup',
  COMPLETE = 'complete',
}

// Selected connection type for user preference
export type SelectedConnection = 'lna' | 'extension' | null;

// User confirmations interface for manual confirmation states
export interface UserConfirmations {
  /** Whether user has confirmed server installation */
  serverInstall: boolean;
}

// Default user confirmations
export const DEFAULT_USER_CONFIRMATIONS: UserConfirmations = {
  serverInstall: false,
};

// Main setup state interface
export interface SetupState {
  /** Extension state details */
  extension: ExtensionState;
  /** Server state details (via extension) */
  server: ServerState;
  /** LNA connection state */
  lna: LnaState;
  /** Server state details (via LNA) */
  lnaServer: LnaServerState;
  /** Environment detection */
  env: EnvState;
  /** Browser platforms list */
  browsers: Browser[];
  /** Operating systems list */
  os: OS[];
  /** User confirmations for manual steps */
  userConfirmations: UserConfirmations;
  /** User's preferred connection method (null = auto-select based on priority) */
  selectedConnection: SelectedConnection;
}

/**
 * Default setup state used during initialization before parent sends real state
 * Represents "loading" state - unknown platform, no extension, no server
 */
export const DEFAULT_SETUP_STATE: SetupState = {
  extension: { status: 'not-installed', error: { message: 'Loading...', code: 'ext-not-installed' } },
  server: { status: 'pending-extension-ready', error: { message: 'Loading...', code: 'server-pending-ext-ready' } },
  lna: { status: 'prompt' },
  lnaServer: { status: 'pending-lna-ready' },
  env: { browser: 'unknown', os: 'unknown' },
  browsers: [],
  os: [],
  userConfirmations: DEFAULT_USER_CONFIRMATIONS,
  selectedConnection: null,
};
