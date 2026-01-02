import type { BackendServerState, ClientState } from '@bodhiapp/bodhi-js-core';
import { BACKEND_SERVER_NOT_CONNECTED, isExtensionState } from '@bodhiapp/bodhi-js-core';
import type { OperationErrorResponse } from '@bodhiapp/bodhi-browser/types';

// ============================================================================
// Flat Client Context State - Following AuthState pattern for consistent DX
// ============================================================================

export type ClientContextStatus =
  | 'not-initialized' // UI state - client not yet created
  | 'initializing' // UI state - client.init() in progress
  | 'extension-not-found' // Extension mode - extension not detected
  | 'direct-not-connected' // Direct mode - URL not configured
  | 'ready'; // Either mode - client ready for API calls

export interface ClientContextState {
  status: ClientContextStatus;
  mode: 'extension' | 'direct' | null; // null when not-initialized/initializing
  extensionId: string | null; // null when not extension mode
  url: string | null; // null when not direct mode
  server: BackendServerState; // always present with its own status
  error: OperationErrorResponse | null;
}

export const INITIAL_CLIENT_CONTEXT_STATE: ClientContextState = {
  status: 'not-initialized',
  mode: null,
  extensionId: null,
  url: null,
  server: BACKEND_SERVER_NOT_CONNECTED,
  error: null,
};

export const INITIALIZING_CLIENT_CONTEXT_STATE: ClientContextState = {
  status: 'initializing',
  mode: null,
  extensionId: null,
  url: null,
  server: BACKEND_SERVER_NOT_CONNECTED,
  error: null,
};

// ============================================================================
// Helper Functions - Simplified status checks
// ============================================================================

export function isClientCtxNotInitialized(state: ClientContextState): boolean {
  return state.status === 'not-initialized';
}

export function isClientCtxInitializing(state: ClientContextState): boolean {
  return state.status === 'initializing';
}

export function isClientCtxInitialized(state: ClientContextState): boolean {
  return state.status !== 'not-initialized' && state.status !== 'initializing';
}

export function isClientCtxReady(state: ClientContextState): boolean {
  return state.status === 'ready';
}

export function isOverallReady(state: ClientContextState): boolean {
  return isClientCtxReady(state) && state.server.status === 'ready';
}

// ============================================================================
// Mapping Function - Transform SDK ClientState to flat ClientContextState
// ============================================================================

export function clientStateToContextState(state: ClientState): ClientContextState {
  if (isExtensionState(state)) {
    const status: ClientContextStatus =
      state.extension === 'not-initialized'
        ? 'initializing'
        : state.extension === 'not-found'
          ? 'extension-not-found'
          : 'ready'; // Single ready status for both modes

    return {
      status,
      mode: 'extension',
      extensionId: state.extensionId,
      url: null,
      server: state.server,
      error: state.server.error,
    };
  } else {
    const status: ClientContextStatus = state.url === null ? 'direct-not-connected' : 'ready'; // Single ready status

    return {
      status,
      mode: 'direct',
      extensionId: null,
      url: state.url,
      server: state.server,
      error: state.server.error,
    };
  }
}

// ============================================================================
// Convenience Namespace - For backward compatibility during migration
// ============================================================================

export const ClientCtxState = {
  isNotInitialized: isClientCtxNotInitialized,
  isInitializing: isClientCtxInitializing,
  isInitialized: isClientCtxInitialized,
  isReady: isClientCtxReady,
  isOverallReady,
} as const;
