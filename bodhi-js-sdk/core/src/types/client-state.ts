/**
 * Client state and initialization types
 */

import type { OperationErrorResponse } from '@bodhiapp/bodhi-browser-types';
import type { DeploymentMode } from '@bodhiapp/ts-client';

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serialized direct client state for persistence
 * Stores minimal state needed to restore direct connection
 */
export type SerializedDirectState = { url?: string };

// ============================================================================
// Connection Mode
// ============================================================================

/**
 * Connection mode - how the client communicates with the local server
 *
 * - 'direct': Direct HTTP fetch to local server (requires LNA permission in web context,
 *   but extension already has network access)
 * - 'extension': Communication via extension (chrome.runtime or window.bodhiext)
 */
export type ConnectionMode = 'direct' | 'extension';

// ============================================================================
// BackendServerState - Backend server connectivity state
// ============================================================================

// --- Constants ---

/**
 * Hardcoded error messages for server states
 */
export const SERVER_ERROR_CODES = {
  NOT_REACHABLE: {
    message: 'server is not reachable on given url',
    type: 'network_error' as const,
  },
  SERVER_NOT_READY: {
    message: 'server is not in ready state, configure to complete setup',
    type: 'extension_error' as const,
  },
} as const;

// --- Type Definitions ---

/**
 * All possible server status values
 * Unified across extension and direct modes
 */
export type ServerStatus =
  | 'not-connected' // Direct mode: not yet configured
  | 'pending-extension-ready' // Extension mode: awaiting extension
  | 'ready' // Server operational
  | 'setup' // Server needs initial setup
  | 'resource_admin' // Server needs resource/admin config
  | 'tenant_selection' // Multi-tenant: tenant selection required
  | 'error' // Server error
  | 'not-reachable'; // Network error/wrong URL

/**
 * Backend server state - flat interface with nullable fields
 * Replaces discriminated union of 5 separate interfaces
 * Different from setup-modal's ServerState which includes UI states
 */
export interface BackendServerState {
  status: ServerStatus;
  version: string | null; // Present when server is reachable
  error: OperationErrorResponse | null; // Present when error occurred
  deployment?: DeploymentMode | null; // Deployment mode from AppInfo
  client_id?: string | null; // Active tenant's OAuth client_id (multi-tenant)
}

// --- Constants ---

export const BACKEND_SERVER_NOT_REACHABLE: BackendServerState = {
  status: 'not-reachable',
  version: null,
  error: SERVER_ERROR_CODES.NOT_REACHABLE,
};

export const PENDING_EXTENSION_READY: BackendServerState = {
  status: 'pending-extension-ready',
  version: null,
  error: null,
};

export const BACKEND_SERVER_NOT_CONNECTED: BackendServerState = {
  status: 'not-connected',
  version: null,
  error: null,
};

/**
 * Raw response from /bodhi/v1/info endpoint
 */
export interface ServerInfoResponse {
  status: 'setup' | 'ready' | 'resource_admin' | 'tenant_selection' | 'error';
  version?: string;
  error?: OperationErrorResponse;
  deployment?: DeploymentMode;
  client_id?: string;
}

// --- Type Guards ---

export function isServerReady(state: BackendServerState): boolean {
  return state.status === 'ready';
}

// --- Factory Functions ---

export function backendServerNotReady(
  status: 'setup' | 'resource_admin' | 'tenant_selection' | 'error',
  version: string = 'unknown',
  error: OperationErrorResponse = SERVER_ERROR_CODES.SERVER_NOT_READY,
  deployment?: DeploymentMode,
  client_id?: string
): BackendServerState {
  return {
    status,
    version,
    error,
    deployment: deployment ?? null,
    client_id: client_id ?? null,
  };
}

// ============================================================================
// ClientState - Base types (needed before DirectState/ExtensionState)
// ============================================================================

/**
 * ClientState - Unified state for extension or direct connectivity
 * Discriminated union with type field: 'extension' | 'direct'
 */
export type ClientState = ExtensionState | DirectState;

/**
 * Serialized client state for localStorage persistence
 * Nested structure storing each client's state separately
 * Server state is transient and not persisted
 */
// Generic extension state - sdk/web uses {}, sdk/ext uses { extensionId?: string }
export type SerializedExtensionState = Record<string, unknown>;

export interface SerializedClientState {
  connectionMode: ConnectionMode | null;
  direct: SerializedDirectState;
  extension: SerializedExtensionState;
}

/**
 * Parameters for client initialization
 * Unified interface with priority handling:
 * - Explicit params (serverUrl, timeoutMs) take priority over savedState
 * - selectedConnection: true → initialize client (get handle/set url), server stays 'not-initialized'
 * - testConnection: true → also test backend server connectivity and update server state
 */
export interface InitParams {
  // Restore from saved state - generic to allow different state shapes
  // Facades pass SerializedClientState, internal clients receive their own type
  savedState?: Record<string, unknown>;

  // Mark client as initialized (get handle/set url), server stays 'not-initialized'
  selectedConnection?: boolean;

  // Also test backend server connectivity and update server state
  testConnection?: boolean;

  // Direct mode: server URL (takes priority over savedState.serverUrl)
  serverUrl?: string;

  // Extension mode: timeout for polling/discovery
  timeoutMs?: number;

  // Extension mode: interval for polling (web mode only)
  intervalMs?: number;

  // API request timeout in milliseconds (both extension and direct modes)
  apiTimeoutMs?: number;
}

// --- Base Type Guards (used by DirectState and ExtensionState) ---

export function isExtensionState(state: ClientState): state is ExtensionState {
  return state.type === 'extension';
}

export function isDirectState(state: ClientState): state is DirectState {
  return state.type === 'direct';
}

// ============================================================================
// DirectState - Direct backend server connectivity
// ============================================================================

// --- Type Definitions ---

/**
 * DirectState - Flat interface with nullable url
 * url is null when not initialized, string when configured
 */
export interface DirectState {
  type: 'direct';
  url: string | null;
  server: BackendServerState;
}

// --- Type Guards ---

export function isDirectServerReady(state: DirectState): boolean {
  return (
    typeof state.server === 'object' &&
    state.server.status !== 'not-connected' &&
    isServerReady(state.server)
  );
}

export function isDirectClientReady(state: DirectState): boolean {
  return state.url !== null;
}

// --- Constants ---

export const DIRECT_STATE_NOT_INITIALIZED: DirectState = {
  type: 'direct',
  url: null,
  server: BACKEND_SERVER_NOT_CONNECTED,
};

// --- Factory Functions ---

export function createDirectStateReady(url: string, version: string = 'unknown'): DirectState {
  return { type: 'direct', server: { status: 'ready', version, error: null }, url };
}

export function createDirectStateNotReachable(url: string): DirectState {
  return { type: 'direct', server: BACKEND_SERVER_NOT_REACHABLE, url };
}

export function createDirectStateNotReady(url: string, server: BackendServerState): DirectState {
  return { type: 'direct', server, url };
}

// ============================================================================
// ExtensionState - Extension connectivity and backend server
// ============================================================================

// --- Type Definitions ---

/**
 * ExtensionState - Flat interface with nullable extensionId
 * extensionId is null when not ready, string when ready
 */
export interface ExtensionState {
  type: 'extension';
  extension: 'not-initialized' | 'not-found' | 'ready';
  extensionId: string | null;
  server: BackendServerState;
}

// --- Constants ---

export const EXTENSION_STATE_NOT_INITIALIZED: ExtensionState = {
  type: 'extension',
  extension: 'not-initialized',
  extensionId: null,
  server: PENDING_EXTENSION_READY,
};

export const EXTENSION_STATE_NOT_FOUND: ExtensionState = {
  type: 'extension',
  extension: 'not-found',
  extensionId: null,
  server: PENDING_EXTENSION_READY,
};

// --- Type Guards ---

export function isExtensionServerReady(state: ExtensionState): boolean {
  return (
    state.extension === 'ready' &&
    state.server.status !== 'pending-extension-ready' &&
    isServerReady(state.server)
  );
}

export function isExtensionClientReady(state: ExtensionState): boolean {
  return state.extension === 'ready';
}

// --- Factory Functions ---

export function createExtensionStateNotInitialized(): ExtensionState {
  return EXTENSION_STATE_NOT_INITIALIZED;
}

export function createExtensionStateNotFound(): ExtensionState {
  return EXTENSION_STATE_NOT_FOUND;
}

// ============================================================================
// Utility Type Guards - Work on ClientState without narrowing
// ============================================================================

/**
 * Check if client is ready (has handle/url) - does NOT require server ready
 * Use this for auth checks and reload state checks
 */
export function isClientReady(state: ClientState): boolean {
  return isExtensionState(state) ? isExtensionClientReady(state) : isDirectClientReady(state);
}

// ============================================================================
// Utility Functions - Safe data extraction
// ============================================================================

/**
 * Get backend server state from client state
 */
export function getBackendServerState(state: ClientState): BackendServerState {
  return state.server;
}

/**
 * Safely get extension ID from client state
 * @returns Extension ID if present, undefined otherwise
 */
export function getExtensionId(state: ClientState): string | undefined {
  return isExtensionState(state) ? (state.extensionId ?? undefined) : undefined;
}

/**
 * Safely get server URL from client state
 * @returns Server URL if present, undefined otherwise
 */
export function getServerUrl(state: ClientState): string | undefined {
  return isDirectState(state) ? (state.url ?? undefined) : undefined;
}
