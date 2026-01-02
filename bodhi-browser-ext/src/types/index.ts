// Bodhi Browser Extension - Shared Types and Constants
// This package provides the shared protocol definitions for communication
// between web pages, external extensions, and bodhi-browser-ext
//
// NOTE: OpenAI types (CreateChatCompletionRequest, PingResponse, etc.)
// are NOT re-exported. Import them directly from '@bodhiapp/ts-client' when needed.

//-----------------------------------------------------------------------------------
// PUBLIC API TYPES (window.bodhiext)
//-----------------------------------------------------------------------------------

export type { ApiResponse, StreamChunk, ServerStateInfo, ApiError, OperationError, ExtensionError, ChatCompletionsApi, ChatApi, BodhiExtPublicApi } from './bodhiext';

export { isApiError, isOperationError } from './bodhiext';

//-----------------------------------------------------------------------------------
// INTERNAL PROTOCOL TYPES
//-----------------------------------------------------------------------------------

export type {
  ApiRequest,
  ApiRequestMessage,
  OperationErrorResponse,
  ApiResponseSuccessMessage,
  OperationErrorResponseMessage,
  ApiResponseMessage,
  ErrorMessage,
  StreamChunkMessage,
  StreamApiErrorMessage,
  StreamErrorMessage,
  StreamMessage,
  StreamController,
  SSEChunk,
  ExtRequest,
  ExtRequestMessage,
  ExtError,
  ExtErrorResponse,
  ExtResponse,
  ExtResponseMessage,
  GetExtensionIdRequest,
  GetExtensionIdResponse,
  TestConnectionRequest,
  TestConnectionResponse,
} from './protocol';

export {
  MESSAGE_TYPES,
  isOperationErrorResponse,
  isApiErrorResponse,
  isApiSuccessResponse,
  isStreamChunk,
  isStreamApiError,
  isStreamError,
  isExtError,
  isOpenAiApiErrorBody,
  isOperationErrorStructure,
} from './protocol';

//-----------------------------------------------------------------------------------
// COMMON CONSTANTS
//-----------------------------------------------------------------------------------

export {
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_EVENT_STREAM,
  CONTENT_TYPE_HEADER,
  HTTP_METHOD_GET,
  HTTP_METHOD_POST,
  ENDPOINT_PING,
  ENDPOINT_CHAT_COMPLETIONS,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT,
  DEFAULT_STREAM_TIMEOUT,
  STORAGE_KEY_BACKEND_URL,
  SSE_DONE_MARKER,
  SSE_DATA_PREFIX,
  SSE_CHUNK_DELIMITER,
  EXT_ACTIONS,
  ERROR_TYPES,
  DOCUMENT_STATE_COMPLETE,
  EVENT_INITIALIZED,
  BODHI_STREAM_PORT,
  ORIGIN_WILDCARD,
  ERROR_MISSING_REQUEST_ID,
  ERROR_CONNECTION_CLOSED,
} from './common';

export type { ConnectionErrorType } from './common';
