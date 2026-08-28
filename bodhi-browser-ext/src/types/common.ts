/**
 * Shared constants for Bodhi Browser Extension
 *
 * Constants used by both inject.ts and background/content.ts scripts,
 * or common to the entire extension.
 */

//-----------------------------------------------------------------------------------
// HTTP CONSTANTS
//-----------------------------------------------------------------------------------

export const CONTENT_TYPE_JSON = 'application/json';
export const CONTENT_TYPE_EVENT_STREAM = 'text/event-stream';
export const CONTENT_TYPE_HEADER = 'Content-Type';
export const HTTP_METHOD_GET = 'GET';
export const HTTP_METHOD_POST = 'POST';

//-----------------------------------------------------------------------------------
// API ENDPOINTS
//-----------------------------------------------------------------------------------

export const ENDPOINT_PING = '/ping';
export const ENDPOINT_CHAT_COMPLETIONS = '/v1/chat/completions';

//-----------------------------------------------------------------------------------
// DEFAULT VALUES
//-----------------------------------------------------------------------------------

export const DEFAULT_API_BASE_URL = 'http://localhost:1135';
export const DEFAULT_API_TIMEOUT = 10000; // 10 seconds for API requests
export const DEFAULT_STREAM_TIMEOUT = 60000; // 60 seconds for streaming

//-----------------------------------------------------------------------------------
// STORAGE
//-----------------------------------------------------------------------------------

export const STORAGE_KEY_BACKEND_URL = 'backendUrl';

//-----------------------------------------------------------------------------------
// SSE (Server-Sent Events)
//-----------------------------------------------------------------------------------

export const SSE_DONE_MARKER = '[DONE]';
export const SSE_DATA_PREFIX = 'data: ';
export const SSE_CHUNK_DELIMITER = '\n\n';

//-----------------------------------------------------------------------------------
// EXTENSION ACTIONS
//-----------------------------------------------------------------------------------

export const EXT_ACTIONS = {
  GET_EXTENSION_ID: 'get_extension_id',
  TEST_CONNECTION: 'test_connection',
  GET_SERVER_STATE: 'get_server_state',
} as const;

//-----------------------------------------------------------------------------------
// ERROR TYPES
//-----------------------------------------------------------------------------------

export const ERROR_TYPES = {
  NETWORK_ERROR: 'network_error',
  EXTENSION_ERROR: 'extension_error',
  TIMEOUT_ERROR: 'timeout_error',
  AUTH_ERROR: 'auth_error',
} as const;

// Type union for connection error types
export type ConnectionErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

//-----------------------------------------------------------------------------------
// DOCUMENT STATES
//-----------------------------------------------------------------------------------

export const DOCUMENT_STATE_COMPLETE = 'complete';

//-----------------------------------------------------------------------------------
// EVENT NAMES
//-----------------------------------------------------------------------------------

export const EVENT_INITIALIZED = 'bodhiext:initialized';

//-----------------------------------------------------------------------------------
// PORT NAMES
//-----------------------------------------------------------------------------------

export const BODHI_STREAM_PORT = 'BODHI_STREAM_PORT';
export const BODHI_STREAM_TEXT_PORT = 'BODHI_STREAM_TEXT_PORT';

//-----------------------------------------------------------------------------------
// FALLBACKS
//-----------------------------------------------------------------------------------

export const ORIGIN_WILDCARD = '*';

//-----------------------------------------------------------------------------------
// ERROR MESSAGES
//-----------------------------------------------------------------------------------

export const ERROR_MISSING_REQUEST_ID = 'Invalid message format: missing requestId or request';
export const ERROR_CONNECTION_CLOSED = 'Connection closed unexpectedly';
