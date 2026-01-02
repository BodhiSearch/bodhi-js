import {
  BrowserType,
  DEFAULT_USER_CONFIRMATIONS,
  LNA_PERMISSION_DENIED,
  LNA_UNREACHABLE,
  LnaServerStateError,
  LnaServerStatePending,
  LnaServerStateReady,
  LnaServerStateResourceAdmin,
  LnaServerStateSetup,
  LnaStateDenied,
  LnaStateGranted,
  LnaStatePrompt,
  LnaStateSkipped,
  LnaStateUnsupported,
  LnaStateUnreachable,
  OSType,
  SetupState,
  Browser,
  OS,
  ExtensionState,
  ServerState,
} from '@/types';

// Browser mock factories
export const createSupportedBrowser = (id: BrowserType, name: string, extension_url: string): Browser => ({
  id,
  status: 'supported',
  name,
  extension_url,
});

export const createNotSupportedBrowser = (id: BrowserType, name: string, github_issue_url?: string): Browser => ({
  id,
  status: 'not-supported',
  name,
  github_issue_url,
});

// OS mock factories
export const createSupportedOS = (id: OSType, name: string, download_url: string): OS => ({
  id,
  status: 'supported',
  name,
  download_url,
});

export const createNotSupportedOS = (id: OSType, name: string, github_issue_url?: string): OS => ({
  id,
  status: 'not-supported',
  name,
  github_issue_url,
});

// Extension state mock factories
export const createReadyExtensionState = (version = '1.0.0', id = 'ext-123'): ExtensionState => ({
  status: 'ready',
  version,
  id,
});

export const createNotInstalledExtensionState = (message = 'Extension is not installed'): ExtensionState => ({
  status: 'not-installed',
  error: {
    message,
    code: 'ext-not-installed',
  },
});

export const createUnreachableExtensionState = (message = 'Could not connect to extension'): ExtensionState => ({
  status: 'unreachable',
  error: {
    message,
    code: 'ext-connection-failed',
  },
});

export const createUnsupportedExtensionState = (message = 'Extension version not supported'): ExtensionState => ({
  status: 'unsupported',
  error: {
    message,
    code: 'ext-unsupported-version',
  },
});

// Server state mock factories
export const createReadyServerState = (version = '2.0.0'): ServerState => ({
  status: 'ready',
  version,
});

export const createUnreachableServerState = (message = 'Server connection refused'): ServerState => ({
  status: 'unreachable',
  error: {
    message,
    code: 'server-conn-refused',
  },
});

export const createPendingServerState = (message = 'Server pending extension ready'): ServerState => ({
  status: 'pending-extension-ready',
  error: {
    message,
    code: 'server-pending-ext-ready',
  },
});

export const createSetupServerState = (message = 'Server requires initial setup', version = '2.0.0'): ServerState => ({
  status: 'setup',
  version,
  error: {
    message,
    code: 'server-in-setup-status',
  },
});

export const createResourceAdminServerState = (message = 'Server in resource admin mode', version = '2.0.0'): ServerState => ({
  status: 'resource-admin',
  version,
  error: {
    message,
    code: 'server-in-admin-status',
  },
});

// LNA state mock factories
export const createLnaPromptState = (): LnaStatePrompt => ({
  status: 'prompt',
});

export const createLnaSkippedState = (): LnaStateSkipped => ({
  status: 'skipped',
});

export const createLnaGrantedState = (serverUrl = 'http://localhost:1135'): LnaStateGranted => ({
  status: 'granted',
  serverUrl,
});

export const createLnaUnreachableState = (serverUrl = 'http://localhost:1135', message = 'Could not connect to server'): LnaStateUnreachable => ({
  status: 'unreachable',
  serverUrl,
  error: {
    message,
    code: LNA_UNREACHABLE,
  },
});

export const createLnaDeniedState = (message = 'Local network access permission denied'): LnaStateDenied => ({
  status: 'denied',
  error: {
    message,
    code: LNA_PERMISSION_DENIED,
  },
});

export const createLnaUnsupportedState = (): LnaStateUnsupported => ({
  status: 'unsupported',
});

// LNA Server state mock factories
export const createLnaServerPendingState = (): LnaServerStatePending => ({
  status: 'pending-lna-ready',
});

export const createLnaServerReadyState = (version = '1.0.0'): LnaServerStateReady => ({
  status: 'ready',
  version,
});

export const createLnaServerSetupState = (version = '1.0.0'): LnaServerStateSetup => ({
  status: 'setup',
  version,
});

export const createLnaServerResourceAdminState = (version = '1.0.0'): LnaServerStateResourceAdmin => ({
  status: 'resource-admin',
  version,
});

export const createLnaServerErrorState = (message = 'Server connection error'): LnaServerStateError => ({
  status: 'error',
  error: {
    message,
  },
});

// Default platform configurations
export const DEFAULT_BROWSERS: Browser[] = [
  createSupportedBrowser('chrome', 'Chrome', 'https://chrome.google.com/webstore'),
  createSupportedBrowser('edge', 'Edge', 'https://microsoftedge.microsoft.com/addons'),
  createNotSupportedBrowser('firefox', 'Firefox', 'https://github.com/bodhi/issues/firefox-support'),
  createNotSupportedBrowser('safari', 'Safari', 'https://github.com/bodhi/issues/safari-support'),
  createNotSupportedBrowser('unknown', 'Unknown Browser'),
];

export const DEFAULT_OS: OS[] = [
  createSupportedOS('macos', 'macOS', 'https://github.com/bodhi/releases/macos'),
  createSupportedOS('windows', 'Windows', 'https://github.com/bodhi/releases/windows'),
  createNotSupportedOS('linux', 'Linux', 'https://github.com/bodhi/issues/linux-support'),
  createNotSupportedOS('unknown', 'Unknown OS'),
];

// Main state factory with sensible defaults
export const createMockState = (overrides: Partial<SetupState> = {}): SetupState => ({
  extension: createReadyExtensionState(),
  server: createReadyServerState(),
  lna: createLnaSkippedState(), // default to skipped for backward compat
  lnaServer: createLnaServerPendingState(),
  env: {
    browser: 'chrome',
    os: 'macos',
  },
  browsers: DEFAULT_BROWSERS,
  os: DEFAULT_OS,
  userConfirmations: DEFAULT_USER_CONFIRMATIONS,
  selectedConnection: null,
  ...overrides,
});

// Specific scenario factories for common test cases
export const createUnsupportedPlatformState = (browser: BrowserType = 'firefox', os: OSType = 'linux'): SetupState =>
  createMockState({
    env: { browser, os },
  });

export const createExtensionNotInstalledState = (): SetupState =>
  createMockState({
    extension: createNotInstalledExtensionState(),
    server: createPendingServerState(),
  });

export const createServerNotReadyState = (): SetupState =>
  createMockState({
    extension: createReadyExtensionState(),
    server: createUnreachableServerState(),
  });

export const createAllSystemsReadyState = (): SetupState =>
  createMockState({
    extension: createReadyExtensionState(),
    server: createReadyServerState(),
    userConfirmations: { serverInstall: true },
  });
