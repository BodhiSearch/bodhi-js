/**
 * Shared types used by both ext2ext and web2ext clients
 */

// Export new SDK-level types
export { isApiResultError, isApiResultOperationError, isApiResultSuccess } from './api';
export type { ApiResponseResult } from './api';

// Export our own error factory functions
export { createApiError, createOperationError } from '../errors';

export {
  BACKEND_SERVER_NOT_CONNECTED,
  BACKEND_SERVER_NOT_REACHABLE,
  // Factory functions - Backend server state
  backendServerNotReady,
  createDirectStateNotReachable,
  createDirectStateNotReady,
  // Factory functions - Direct state
  createDirectStateReady,
  createExtensionStateNotFound,
  // Factory functions - Extension state
  createExtensionStateNotInitialized,
  DIRECT_STATE_NOT_INITIALIZED,
  // Constants - Client state
  EXTENSION_STATE_NOT_FOUND,
  EXTENSION_STATE_NOT_INITIALIZED,
  getBackendServerState,
  // Utility functions
  getExtensionId,
  getServerUrl,
  // Type guards - ClientState utilities
  isClientReady,
  // Type guards - Direct state (client ready)
  isDirectClientReady,
  // Type guards - Direct state (server ready)
  isDirectServerReady,
  isDirectState,
  // Type guards - Extension state (client ready)
  isExtensionClientReady,
  // Type guards - Extension state (server ready)
  isExtensionServerReady,
  // Type guards - Extension/Direct discrimination
  isExtensionState,
  // Type guards - Backend server state
  isServerReady,
  PENDING_EXTENSION_READY,
  // Constants - Server state
  SERVER_ERROR_CODES,
} from './client-state';
export type {
  // Backend Server State
  BackendServerState,
  // Client State
  ClientState,
  // Connection Mode
  ConnectionMode,
  // Direct State
  DirectState,
  // Extension State
  ExtensionState,
  InitParams,
  // Serialization
  SerializedClientState,
  SerializedDirectState,
  SerializedExtensionState,
  ServerInfoResponse,
  ServerStatus,
} from './client-state';

export { INITIAL_AUTH_STATE, isAuthError, isAuthLoading, isAuthenticated } from './auth';
export type { AuthError, AuthState, AuthStatus } from './auth';

export type { Tokens, UserInfo, UserScope } from './user-info';

export type { ClientConfig, DiscoveryResult, LogLevel } from './config';

export type { BrowserInfo, OSInfo } from './platform';

export { NOOP_STATE_CALLBACK } from './callback';
export type {
  AuthStateChange,
  ClientStateChange,
  StateChange,
  StateChangeCallback,
} from './callback';

// Re-export protocol utilities from local implementation
export { buildError, buildEvent, buildResponse, handleRequest } from '../onboarding/protocol-utils';
