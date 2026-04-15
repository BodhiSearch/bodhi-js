// Import types for ext2ext communication with bodhi-browser-ext
import type { UserInfo } from '@bodhiapp/bodhi-js-core';
import type {
  ApiRequest,
  ApiResponse,
  ExtRequest,
  ExtResponse,
  OperationErrorResponse,
} from '@bodhiapp/bodhi-browser-types';
import type { ErrorResponse } from '@bodhiapp/ts-client/openai';
import { EXT2EXT_CLIENT_MESSAGE_TYPES } from './constants';

// Note: Type imports from upstream projects should be imported directly:
// - Protocol types: import from '@bodhiapp/bodhi-js-core/bodhi-browser'
// - Management types: import from '@bodhiapp/ts-client'
// - OpenAI types: import from '@bodhiapp/ts-client/openai'

// ============================================================================
// Extended Types
// ============================================================================

// Extended API request type with authentication flag
export type ExtClientApiRequest<T = unknown> = ApiRequest<T> & { authenticated?: boolean };

// ============================================================================
// Extension Message Protocol Types (aligned with bodhi-browser-ext structure)
// ============================================================================

/**
 * extension client request message
 */
export interface ExtClientRequestMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST;
  requestId: string;
  request: ExtRequest;
}

// ============================================================================
// ExtClientResponse Types (reuses ExtResponse from bodhi-browser/types)
// ============================================================================

/**
 * Response data types for each action
 */
export interface GetUserInfoResponseData {
  userInfo: UserInfo | null;
}

export interface IsLoggedInResponseData {
  isLoggedIn: boolean;
}

export interface DiscoverExtensionResponseData {
  extensionId: string;
  environment: string;
}

export interface GetExtensionIdResponseData {
  extension_id: string;
}

/**
 * extension client response message
 * Uses ExtResponse<T> = T | ExtErrorResponse from bodhi-browser/types
 */
export interface ExtClientResponseMessage<T = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE;
  requestId: string;
  response: ExtResponse<T>;
}

/**
 * extension client broadcast message (no requestId, event-based)
 */
export interface ExtClientBroadcastMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_BROADCAST;
  event: string;
}

/**
 * extension client API request message for HTTP operations
 */
export interface ExtClientApiRequestMessage<TReq = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_REQUEST;
  requestId: string;
  request: ExtClientApiRequest<TReq>;
}

/**
 * Error structure for API errors (network failures, extension errors)
 */
export interface ExtClientApiError {
  message: string;
  type?: string;
}

/**
 * Success API response message (HTTP request completed)
 */
export interface ExtClientApiResponseSuccessMessage<T = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE;
  requestId: string;
  response: ApiResponse<T>;
}

/**
 * Error API response message (HTTP request couldn't complete)
 */
export interface ExtClientApiResponseErrorMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE;
  requestId: string;
  error: ExtClientApiError;
}

/**
 * API response message - discriminated union
 */
export type ExtClientApiResponseMessage<T = unknown> =
  | ExtClientApiResponseSuccessMessage<T>
  | ExtClientApiResponseErrorMessage;

/**
 * Type guard to check if API response is an error
 */
export function isExtClientApiError(
  msg: ExtClientApiResponseMessage
): msg is ExtClientApiResponseErrorMessage {
  return 'error' in msg;
}

// ============================================================================
// Streaming Types (Generic - matches bodhi-browser-ext format)
// ============================================================================

/**
 * Streaming request - extends ApiRequest with authentication flag
 * Flat structure (no nested request.request)
 */
export type ExtClientStreamRequest<TReq = unknown> = ApiRequest<TReq> & {
  authenticated?: boolean;
};

/**
 * Streaming request message - same format as ApiRequestMessage
 */
export interface ExtClientStreamRequestMessage<TReq = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_REQUEST;
  requestId: string;
  request: ExtClientStreamRequest<TReq>;
}

/**
 * Streaming chunk message - same format as ApiStreamChunkMessage
 * Uses `response` field (not `chunk`)
 */
export interface ExtClientStreamChunkMessage<TRes = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_CHUNK;
  requestId: string;
  response: ApiResponse<TRes>; // ← Same as bodhi-browser-ext
}

/**
 * Streaming API error message - same format as ApiStreamApiErrorMessage
 */
export interface ExtClientStreamApiErrorMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_API_ERROR;
  requestId: string;
  response: ApiResponse<ErrorResponse>; // ← Same as bodhi-browser-ext
}

/**
 * Streaming error message - same format as StreamErrorMessage from bodhi-browser-ext
 * Uses `error: OperationErrorResponse` (network/extension/timeout errors)
 */
export interface ExtClientStreamErrorMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_ERROR;
  requestId: string;
  error: OperationErrorResponse; // ← Same as bodhi-browser-ext StreamErrorMessage
}

/**
 * Streaming done message (ext2ext specific - explicit completion signal)
 */
export interface ExtClientStreamDoneMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_DONE;
  requestId: string;
}

/**
 * Union type for all ext2ext streaming messages
 */
export type ExtClientStreamMessage<TRes = unknown> =
  | ExtClientStreamChunkMessage<TRes>
  | ExtClientStreamApiErrorMessage
  | ExtClientStreamErrorMessage
  | ExtClientStreamDoneMessage;

// ============================================================================
// Stream Text Types (Raw text streaming - no SSE/JSON parsing)
// ============================================================================

/**
 * Stream text request message
 */
export interface ExtClientStreamTextRequestMessage<TReq = unknown> {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_REQUEST;
  requestId: string;
  request: ExtClientStreamRequest<TReq> & { authenticated?: boolean };
}

/**
 * Stream text start message - response metadata (status + headers)
 * Sent once before any stream text chunk messages
 */
export interface ExtClientStreamTextStartMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_START;
  requestId: string;
  status: number;
  headers: Record<string, string>;
}

/**
 * Stream text chunk message - raw text from response body
 */
export interface ExtClientStreamTextChunkMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_CHUNK;
  requestId: string;
  chunk: string;
}

/**
 * Stream text done message - stream completed
 */
export interface ExtClientStreamTextDoneMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_DONE;
  requestId: string;
}

/**
 * Stream text error message - network/extension level error
 */
export interface ExtClientStreamTextErrorMessage {
  type: typeof EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_ERROR;
  requestId: string;
  error: OperationErrorResponse;
}

/**
 * Union type for all ext2ext stream text messages (received by UI)
 */
export type ExtClientStreamTextMessage =
  | ExtClientStreamTextStartMessage
  | ExtClientStreamTextChunkMessage
  | ExtClientStreamTextDoneMessage
  | ExtClientStreamTextErrorMessage;
