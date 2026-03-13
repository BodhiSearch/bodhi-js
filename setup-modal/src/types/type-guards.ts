import type { ExtensionState, ExtensionStateNotReady, ExtensionStateReady } from './extension';
import type { ServerState, ServerStateError, ServerStatePending, ServerStateReachable, ServerStateReady, ServerStateUnreachable } from './server';
import type {
  LnaServerState,
  LnaServerStateError,
  LnaServerStatePending,
  LnaServerStateReady,
  LnaServerStateResourceAdmin,
  LnaServerStateSetup,
  LnaServerStateTenantSelection,
  LnaState,
  LnaStateDenied,
  LnaStateGranted,
  LnaStatePrompt,
  LnaStateSkipped,
  LnaStateUnreachable,
  LnaStateUnsupported,
} from './lna';
import type { Browser, NotSupportedBrowser, NotSupportedOS, OS, SupportedBrowser, SupportedOS } from './platform';

// ============================================
// Extension Type Guards
// ============================================

export function isExtensionStateReady(ext: ExtensionState): ext is ExtensionStateReady {
  return ext.status === 'ready';
}

export function isExtensionStateNotReady(ext: ExtensionState): ext is ExtensionStateNotReady {
  return ext.status !== 'ready';
}

// ============================================
// Server Type Guards
// ============================================

export function isServerStateReady(server: ServerState): server is ServerStateReady {
  return server.status === 'ready';
}

export function isServerStateReachable(server: ServerState): server is ServerStateReachable {
  return server.status === 'setup' || server.status === 'resource_admin' || server.status === 'tenant_selection';
}

export function isServerStatePending(server: ServerState): server is ServerStatePending {
  return server.status === 'pending-extension-ready';
}

export function isServerStateUnreachable(server: ServerState): server is ServerStateUnreachable {
  return server.status === 'unreachable';
}

export function isServerStateError(server: ServerState): server is ServerStateError {
  return server.status === 'error';
}

// ============================================
// LNA Type Guards
// ============================================

export function isLnaStatePrompt(lna: LnaState): lna is LnaStatePrompt {
  return lna.status === 'prompt';
}

export function isLnaStateSkipped(lna: LnaState): lna is LnaStateSkipped {
  return lna.status === 'skipped';
}

export function isLnaStateGranted(lna: LnaState): lna is LnaStateGranted {
  return lna.status === 'granted';
}

export function isLnaStateUnreachable(lna: LnaState): lna is LnaStateUnreachable {
  return lna.status === 'unreachable';
}

export function isLnaStateDenied(lna: LnaState): lna is LnaStateDenied {
  return lna.status === 'denied';
}

export function isLnaStateUnsupported(lna: LnaState): lna is LnaStateUnsupported {
  return lna.status === 'unsupported';
}

// ============================================
// LNA Server Type Guards
// ============================================

export function isLnaServerStatePending(server: LnaServerState): server is LnaServerStatePending {
  return server.status === 'pending-lna-ready';
}

export function isLnaServerStateReady(server: LnaServerState): server is LnaServerStateReady {
  return server.status === 'ready';
}

export function isLnaServerStateSetup(server: LnaServerState): server is LnaServerStateSetup {
  return server.status === 'setup';
}

export function isLnaServerStateResourceAdmin(server: LnaServerState): server is LnaServerStateResourceAdmin {
  return server.status === 'resource_admin';
}

export function isLnaServerStateTenantSelection(server: LnaServerState): server is LnaServerStateTenantSelection {
  return server.status === 'tenant_selection';
}

export function isLnaServerStateError(server: LnaServerState): server is LnaServerStateError {
  return server.status === 'error';
}

// ============================================
// Browser/OS Type Guards
// ============================================

export function isSupportedBrowser(browser: Browser): browser is SupportedBrowser {
  return browser.status === 'supported';
}

export function isNotSupportedBrowser(browser: Browser): browser is NotSupportedBrowser {
  return browser.status === 'not-supported';
}

export function isSupportedOS(os: OS): os is SupportedOS {
  return os.status === 'supported';
}

export function isNotSupportedOS(os: OS): os is NotSupportedOS {
  return os.status === 'not-supported';
}
