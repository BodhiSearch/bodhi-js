/**
 * Internal extension protocol types
 *
 * Message passing types and constants for communication between
 * inject.ts, content.ts, and background.ts (service worker).
 * Used primarily by background/*, content.ts files.
 */

import type { BodhiErrorResponse } from '@bodhiapp/ts-client';
import type { ApiResponse, ServerStateInfo } from './bodhiext';

//-----------------------------------------------------------------------------------
// VALIDATION HELPERS
//-----------------------------------------------------------------------------------

/**
 * Private helper: Check if value is non-null object
 * Not exported - implementation detail for other helpers
 */
function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Validate Bodhi API error body structure
 * { error: { message: string, type: string } }
 */
export function isBodhiErrorResponseBody(body: unknown): body is BodhiErrorResponse {
  return (
    isNonNullObject(body) &&
    'error' in body &&
    isNonNullObject(body.error) &&
    'message' in body.error &&
    typeof body.error.message === 'string' &&
    'type' in body.error &&
    typeof body.error.type === 'string'
  );
}

/**
 * Validate OperationErrorResponse structure
 * { message: string, type: string }
 */
export function isOperationErrorStructure(obj: unknown): obj is OperationErrorResponse {
  return isNonNullObject(obj) && 'message' in obj && typeof obj.message === 'string' && 'type' in obj && typeof obj.type === 'string';
}

//-----------------------------------------------------------------------------------
// MESSAGE TYPE CONSTANTS
//-----------------------------------------------------------------------------------

export const MESSAGE_TYPES = {
  API_REQUEST: 'BODHI_API_REQUEST',
  API_RESPONSE: 'BODHI_API_RESPONSE',
  STREAM_REQUEST: 'BODHI_STREAM_REQUEST',
  STREAM_CHUNK: 'BODHI_STREAM_CHUNK',
  STREAM_ERROR: 'BODHI_STREAM_ERROR',
  STREAM_API_ERROR: 'BODHI_STREAM_API_ERROR',
  STREAM_TEXT_REQUEST: 'BODHI_STREAM_TEXT_REQUEST',
  STREAM_TEXT_START: 'BODHI_STREAM_TEXT_START',
  STREAM_TEXT_CHUNK: 'BODHI_STREAM_TEXT_CHUNK',
  STREAM_TEXT_DONE: 'BODHI_STREAM_TEXT_DONE',
  STREAM_TEXT_ERROR: 'BODHI_STREAM_TEXT_ERROR',
  ERROR: 'BODHI_ERROR',
  EXT_REQUEST: 'BODHI_EXT_REQUEST',
  EXT_RESPONSE: 'BODHI_EXT_RESPONSE',
} as const;

//-----------------------------------------------------------------------------------
// API REQUEST/RESPONSE TYPES
//-----------------------------------------------------------------------------------

export interface ApiRequest<T = unknown> {
  method: string;
  endpoint: string;
  body?: T;
  headers?: Record<string, string>;
}

export interface ApiRequestMessage<TReq = unknown> {
  type: string;
  requestId: string;
  request: ApiRequest<TReq>;
}

/**
 * Operation-level error response (network unreachable, timeout, extension error)
 * NOT an API error (those come through ApiResponse with BodhiErrorResponse body)
 * This is a response type, not a thrown error
 */
export interface OperationErrorResponse {
  message: string;
  type: string; // Relaxed: any string allowed for custom error types
}

/**
 * Success API response message (HTTP request completed, regardless of status code)
 */
export interface ApiResponseSuccessMessage<T = unknown> {
  type: string;
  requestId: string;
  response: ApiResponse<T>;
}

/**
 * Operation error response message - HTTP request couldn't complete
 */
export interface OperationErrorResponseMessage {
  type: string;
  requestId: string;
  error: OperationErrorResponse;
}

/**
 * API response message - discriminated union
 */
export type ApiResponseMessage<T = unknown> = ApiResponseSuccessMessage<T> | OperationErrorResponseMessage;

/**
 * Type guard for operation error response
 */
export function isOperationErrorResponse(msg: ApiResponseMessage): msg is OperationErrorResponseMessage {
  return isNonNullObject(msg) && 'error' in msg && isOperationErrorStructure(msg.error);
}

/**
 * Type guard to check if response is an API error (4xx/5xx)
 * Narrows body type to BodhiErrorResponse
 */
export function isApiErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { body: BodhiErrorResponse; status: number } {
  return isNonNullObject(response) && typeof response.status === 'number' && response.status >= 400 && isBodhiErrorResponseBody(response.body);
}

/**
 * Type guard to check if response is successful (2xx)
 * Narrows body type to T
 */
export function isApiSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { body: T; status: number } {
  return response !== null && typeof response === 'object' && typeof response.status === 'number' && response.status >= 200 && response.status < 300 && 'body' in response;
}

//-----------------------------------------------------------------------------------
// STREAMING MESSAGE TYPES (Discriminated Union)
//-----------------------------------------------------------------------------------

/**
 * Stream chunk message - successful SSE chunk received
 * Uses ApiResponse<T> wrapper for consistency with non-streaming pattern
 */
export interface StreamChunkMessage<T = unknown> {
  type: typeof MESSAGE_TYPES.STREAM_CHUNK;
  requestId: string;
  response: ApiResponse<T>;
}

/**
 * Stream API error message - server returned error response (not SSE)
 * E.g., 400/401/500 JSON error instead of SSE stream
 */
export interface StreamApiErrorMessage {
  type: typeof MESSAGE_TYPES.STREAM_API_ERROR;
  requestId: string;
  response: ApiResponse<BodhiErrorResponse>;
}

/**
 * Stream error message - network/extension level error
 * E.g., connection refused, timeout, extension error
 */
export interface StreamErrorMessage {
  type: typeof MESSAGE_TYPES.STREAM_ERROR;
  requestId: string;
  error: OperationErrorResponse;
}

/**
 * Union type for all streaming messages
 */
export type StreamMessage<T = unknown> = StreamChunkMessage<T> | StreamApiErrorMessage | StreamErrorMessage;

/**
 * Type guard for stream chunk message
 */
export function isStreamChunk<T>(msg: StreamMessage<T>): msg is StreamChunkMessage<T> {
  return msg !== null && typeof msg === 'object' && msg.type === MESSAGE_TYPES.STREAM_CHUNK;
}

/**
 * Type guard for stream API error
 */
export function isStreamApiError(msg: StreamMessage): msg is StreamApiErrorMessage {
  return msg !== null && typeof msg === 'object' && msg.type === MESSAGE_TYPES.STREAM_API_ERROR;
}

/**
 * Type guard for stream error
 */
export function isStreamError(msg: StreamMessage): msg is StreamErrorMessage {
  return msg !== null && typeof msg === 'object' && msg.type === MESSAGE_TYPES.STREAM_ERROR;
}

//-----------------------------------------------------------------------------------
// RAW TEXT STREAMING MESSAGE TYPES (no SSE/JSON parsing)
//-----------------------------------------------------------------------------------

/**
 * Stream text start message — response metadata (status + headers)
 * Sent once before any STREAM_TEXT_CHUNK messages
 */
export interface StreamTextStartMessage {
  type: typeof MESSAGE_TYPES.STREAM_TEXT_START;
  requestId: string;
  status: number;
  headers: Record<string, string>;
}

/**
 * Stream text chunk message — raw text from response body
 * No SSE parsing, no JSON.parse, no data: prefix stripping
 */
export interface StreamTextChunkMessage {
  type: typeof MESSAGE_TYPES.STREAM_TEXT_CHUNK;
  requestId: string;
  chunk: string;
}

/**
 * Stream text done message — stream completed
 */
export interface StreamTextDoneMessage {
  type: typeof MESSAGE_TYPES.STREAM_TEXT_DONE;
  requestId: string;
}

/**
 * Stream text error message — network/extension level error
 */
export interface StreamTextErrorMessage {
  type: typeof MESSAGE_TYPES.STREAM_TEXT_ERROR;
  requestId: string;
  error: OperationErrorResponse;
}

/**
 * Union type for all stream text messages
 */
export type StreamTextMessage = StreamTextStartMessage | StreamTextChunkMessage | StreamTextDoneMessage | StreamTextErrorMessage;

/**
 * Interface for stream controller to handle SSE responses
 */
export interface StreamController {
  enqueue: (chunk: any) => void;
  error: (err: Error) => void;
  complete: () => void;
}

/**
 * Interface for SSE data chunk
 */
export interface SSEChunk {
  done?: boolean;
  [key: string]: any;
}

//-----------------------------------------------------------------------------------
// GENERIC EXTENSION REQUEST/RESPONSE TYPES
//-----------------------------------------------------------------------------------

/**
 * Generic extension request interface
 */
export interface ExtRequest {
  action: string;
  params?: any;
}

/**
 * Generic extension request message
 */
export interface ExtRequestMessage {
  type: 'BODHI_EXT_REQUEST';
  requestId: string;
  request: ExtRequest;
}

/**
 * Extension-level error structure
 */
export interface ExtError {
  message: string;
  type?: string;
}

/**
 * Error response for extension operations
 */
export interface ExtErrorResponse {
  error: ExtError;
}

/**
 * Union type for extension response (flattened - no wrapper for success)
 * Success: T (the actual response data)
 * Error: { error: ExtError }
 */
export type ExtResponse<T = unknown> = T | ExtErrorResponse;

/**
 * Type guard to check if extension response is an error
 */
export function isExtError<T>(res: ExtResponse<T>): res is ExtErrorResponse {
  return res !== null && typeof res === 'object' && 'error' in res;
}

/**
 * Generic extension response message
 */
export interface ExtResponseMessage<T = unknown> {
  type: 'BODHI_EXT_RESPONSE';
  requestId: string;
  response: ExtResponse<T>;
}

//-----------------------------------------------------------------------------------
// ACTION-SPECIFIC TYPES
//-----------------------------------------------------------------------------------

/**
 * Get Extension ID request (no params needed)
 */
export interface GetExtensionIdRequest extends ExtRequest {
  action: 'get_extension_id';
  params?: undefined;
}

/**
 * Get Extension ID response body
 */
export interface GetExtensionIdResponse {
  extension_id: string;
}

/**
 * Test Connection request
 */
export interface TestConnectionRequest extends ExtRequest {
  action: 'test_connection';
  params: {
    url: string;
  };
}

/**
 * Test Connection response body (reuses ServerStateInfo)
 */
export type TestConnectionResponse = ServerStateInfo;
