/**
 * Shared types used by both ext2ext and web2ext clients
 */

// Re-export error classes and utilities from bodhi-browser-ext types
export { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-browser-types';
export type { BodhiErrorCode } from '@bodhiapp/bodhi-browser-types';

// Export error factory functions (backward compatibility wrappers)
export { createApiError, createOperationError, throwAccessRequestDenialError } from '../errors';

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

export type { Tokens, UserInfo } from './user-info';

export type { ClientConfig, DiscoveryResult, LogLevel } from './config';

// Login progress types
export type LoginProgressStage = 'requesting' | 'reviewing' | 'authenticating';
export type LoginProgressCallback = (stage: LoginProgressStage) => void;

// Login options
import type { RequestedResourcesV1, UserScope } from '@bodhiapp/ts-client';
export interface LoginOptions {
  userRole?: UserScope;
  requested?: RequestedResourcesV1;
  onProgress?: LoginProgressCallback;
  /**
   * Exchange (upgrade) the current grant. When true, login proceeds even if already
   * authenticated: the access request is sent with `exchange: true` and the current token,
   * so the review page pre-populates from the source grant and approval replaces the stored
   * tokens with the newly granted ones. When false/undefined an authenticated session
   * short-circuits login (to force a fresh login, logout then login).
   */
  exchange?: boolean;
}

export type { BrowserInfo, OSInfo } from './platform';

export { InMemoryStorage } from './storage';
export type { IStorage, InitialTokens } from './storage';

export { NOOP_STATE_CALLBACK } from './callback';
export type {
  AuthStateChange,
  ClientStateChange,
  StateChange,
  StateChangeCallback,
} from './callback';

// Re-export protocol utilities from local implementation
export { buildError, buildEvent, buildResponse, handleRequest } from '../onboarding/protocol-utils';

// MCP transport types
export type { McpFetchLike, McpTransportConfig } from '../mcp-fetch';
