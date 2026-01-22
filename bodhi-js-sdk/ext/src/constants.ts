// ============================================================================
// Message Protocol Constants
// ============================================================================

// Internal protocol for communication within bodhijs-ext-test-app (web page ↔ background)
// Three message protocols:
// 1. EXT2EXT_CLIENT_REQUEST/RESPONSE: Internal OAuth operations (login, logout, etc.)
//    and extension operations (getExtensionId via EXT_REQUEST to bodhi-browser-ext)
// 2. EXT2EXT_CLIENT_API_REQUEST/RESPONSE: HTTP API operations forwarded to bodhi-browser-ext
//    via API_REQUEST protocol (future use for chat completions, etc.)
// 3. EXT2EXT_CLIENT_BROADCAST: Event broadcasts for state changes (authStateChanged)
export const EXT2EXT_CLIENT_MESSAGE_TYPES = {
  EXT2EXT_CLIENT_REQUEST: 'EXT2EXT_CLIENT_REQUEST',
  EXT2EXT_CLIENT_RESPONSE: 'EXT2EXT_CLIENT_RESPONSE',
  EXT2EXT_CLIENT_BROADCAST: 'EXT2EXT_CLIENT_BROADCAST',
  EXT2EXT_CLIENT_API_REQUEST: 'EXT2EXT_CLIENT_API_REQUEST',
  EXT2EXT_CLIENT_API_RESPONSE: 'EXT2EXT_CLIENT_API_RESPONSE',
  // Streaming message types (UI → background)
  EXT2EXT_CLIENT_STREAM_REQUEST: 'EXT2EXT_CLIENT_STREAM_REQUEST',
  EXT2EXT_CLIENT_STREAM_CHUNK: 'EXT2EXT_CLIENT_STREAM_CHUNK',
  EXT2EXT_CLIENT_STREAM_ERROR: 'EXT2EXT_CLIENT_STREAM_ERROR',
  EXT2EXT_CLIENT_STREAM_API_ERROR: 'EXT2EXT_CLIENT_STREAM_API_ERROR',
  EXT2EXT_CLIENT_STREAM_DONE: 'EXT2EXT_CLIENT_STREAM_DONE',
} as const;

// Port name for UI streaming connections
export const EXT2EXT_CLIENT_STREAM_PORT = 'ext2ext-client-stream';

// Actions handled by BodhiExtClient
export const EXT2EXT_CLIENT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  GET_AUTH_STATE: 'getAuthState',
  DISCOVER_EXTENSION: 'discoverBodhiExtension',
  GET_EXTENSION_ID: 'get_extension_id',
  SET_EXTENSION_ID: 'setExtensionId',
} as const;

// ============================================================================
// Discovery Defaults
// ============================================================================

// Discovery defaults for ext2ext communication (mirroring ext2ext-client hardcoded values)
export const DISCOVERY_TIMEOUT_MS = 5000;
export const DISCOVERY_ATTEMPTS = 3;
export const DISCOVERY_ATTEMPT_WAIT_MS = 500;
export const DISCOVERY_ATTEMPT_TIMEOUT = 500;

/**
 * Default API request timeout in milliseconds
 * Used for API requests through extension communication
 * Default: 30 seconds
 */
export const DEFAULT_API_TIMEOUT_MS = 30000;
