/**
 * Public API types for window.bodhiext interface
 *
 * This file defines the contract web pages use to communicate with the Bodhi browser extension.
 * Used primarily by inject.ts to create the window.bodhiext API surface.
 */

import type { AppStatus, PingResponse } from '@bodhiapp/ts-client';
import type { ErrorResponse, CreateChatCompletionRequest, CreateChatCompletionResponse, CreateChatCompletionStreamResponse } from '@bodhiapp/ts-client/openai';

//-----------------------------------------------------------------------------------
// HTTP RESPONSE TYPES
//-----------------------------------------------------------------------------------

/**
 * HTTP response wrapper - body can be success type OR error type
 * Use isApiErrorResponse() to narrow the type based on status
 */
export interface ApiResponse<T = unknown> {
  body: T | ErrorResponse;
  status: number;
  headers: Record<string, string>;
}

/**
 * Stream chunk returned by sendStreamRequest
 *
 * This is the chunk structure yielded by the ReadableStream from sendStreamRequest.
 * Different from StreamChunkMessage which is the internal message wrapper.
 */
export interface StreamChunk {
  body: unknown;
  headers?: Record<string, string>;
  status?: number;
  done?: boolean;
}

/**
 * Server state information returned by /bodhi/v1/info endpoint
 */
export interface ServerStateInfo {
  /** Current application status */
  status: AppStatus | 'error' | 'unreachable';
  /** Application version */
  version?: string;
  /** Server URL (added by extension) */
  url?: string;
  /** Error details if status is 'error' or 'unreachable' */
  error?: {
    message: string;
    type?: string;
    code?: string;
    param?: string;
  };
}

//-----------------------------------------------------------------------------------
// CHAT API TYPES (OpenAI-compatible from @bodhiapp/ts-client)
//-----------------------------------------------------------------------------------

/**
 * Chat API uses types from @bodhiapp/ts-client.
 * Consumers should import these types directly from @bodhiapp/ts-client:
 * - ChatCompletionRequestMessage
 * - ChatCompletionResponseMessage
 * - CreateChatCompletionRequest
 * - CreateChatCompletionResponse
 * - CreateChatCompletionStreamResponse
 * - ChatChoice
 * - ChatChoiceStream
 * - ChatCompletionStreamResponseDelta
 */

/**
 * Chat completions API interface
 */
export interface ChatCompletionsApi {
  /**
   * Create a chat completion
   *
   * Non-streaming: Returns ApiResponse - caller checks status for success/error
   * Streaming: Yields chunks via AsyncIterable - throws BodhiApiError or BodhiError on error
   *
   * @param params - Chat completion parameters
   * @returns Non-streaming: Promise<ApiResponse<CreateChatCompletionResponse>>, Streaming: AsyncIterable<CreateChatCompletionStreamResponse>
   */
  create(params: CreateChatCompletionRequest & { stream?: false }): Promise<ApiResponse<CreateChatCompletionResponse>>;
  create(params: CreateChatCompletionRequest & { stream: true }): AsyncIterable<CreateChatCompletionStreamResponse>;
  create(params: CreateChatCompletionRequest): Promise<ApiResponse<CreateChatCompletionResponse>> | AsyncIterable<CreateChatCompletionStreamResponse>;
}

/**
 * Chat API namespace
 */
export interface ChatApi {
  completions: ChatCompletionsApi;
}

//-----------------------------------------------------------------------------------
// PUBLIC API INTERFACE
//-----------------------------------------------------------------------------------

/**
 * Public window.bodhiext interface
 *
 * This interface defines all methods available to web pages through window.bodhiext.
 * The extension creates this interface in inject.ts and attaches it to the window object.
 */
export interface BodhiExtPublicApi {
  /**
   * Send a generic API request through the extension to the backend server.
   *
   * @template TReq - Request body type (inferred from body parameter)
   * @template TRes - Response body type (must be specified explicitly)
   * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param endpoint - API endpoint path (e.g., '/v1/chat/completions')
   * @param body - Optional request body (will be JSON stringified)
   * @param headers - Optional additional headers
   * @returns Promise resolving to ApiResponse with body, headers, and status
   */
  sendApiRequest<TReq = unknown, TRes = unknown>(method: string, endpoint: string, body?: TReq, headers?: Record<string, string>): Promise<ApiResponse<TRes>>;

  /**
   * Send a streaming API request through the extension.
   *
   * Used for SSE (Server-Sent Events) endpoints like streaming chat completions.
   * Returns a ReadableStream that yields StreamChunk objects.
   *
   * @template TReq - Request body type (inferred from body parameter)
   * @param method - HTTP method (typically POST for streaming)
   * @param endpoint - API endpoint path (e.g., '/v1/chat/completions')
   * @param body - Optional request body
   * @param headers - Optional additional headers
   * @returns ReadableStream yielding StreamChunk objects
   */
  sendStreamRequest<TReq = unknown>(method: string, endpoint: string, body?: TReq, headers?: Record<string, string>): ReadableStream<StreamChunk>;

  /**
   * Send a raw text streaming request through the extension.
   *
   * Unlike sendStreamRequest which parses SSE/JSON, this forwards raw response
   * bytes as text strings without any parsing. Returns response metadata (status,
   * headers) plus a ReadableStream of raw text chunks.
   *
   * @template TReq - Request body type (inferred from body parameter)
   * @param method - HTTP method
   * @param endpoint - API endpoint path
   * @param body - Optional request body
   * @param headers - Optional additional headers
   * @returns Promise with status, headers, and ReadableStream<string> body
   */
  sendStreamText<TReq = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>
  ): Promise<{ status: number; headers: Record<string, string>; body: ReadableStream<string> }>;

  /**
   * Send a generic extension request.
   *
   * Used for extension-specific operations like test_connection, get_extension_id, etc.
   * This is a low-level API for extension capabilities.
   *
   * @param action - Extension action name (e.g., 'test_connection')
   * @param params - Optional action parameters
   * @returns Promise resolving to action-specific response
   */
  sendExtRequest(action: string, params?: any): Promise<any>;

  /**
   * Simple health check to verify extension connectivity.
   *
   * Returns ApiResponse - caller should check status to determine success/error.
   * On success (2xx), body is PingResponse. On error (4xx/5xx), body is ErrorResponse.
   *
   * @returns Promise resolving to ApiResponse<PingResponse>
   */
  ping(): Promise<ApiResponse<PingResponse>>;

  /**
   * Get server state information from /bodhi/v1/info endpoint.
   *
   * Returns the current status of the backend server including
   * whether it's in setup mode, ready, or has errors.
   *
   * @returns Promise resolving to ServerStateInfo
   */
  serverState(): Promise<ServerStateInfo>;

  /**
   * OpenAI-compatible chat API.
   *
   * Provides chat completion functionality compatible with OpenAI's API structure.
   */
  chat: ChatApi;

  /**
   * Get the extension ID.
   *
   * The extension ID is fetched asynchronously during initialization.
   * This method returns a promise that resolves to the extension ID once available.
   *
   * @returns Promise resolving to the extension ID string
   */
  getExtensionId(): Promise<string>;
}

//-----------------------------------------------------------------------------------
// WINDOW AUGMENTATION
//-----------------------------------------------------------------------------------

/**
 * Window augmentation for TypeScript
 *
 * Declares the optional bodhiext property on the Window interface.
 * This allows TypeScript code to access window.bodhiext with proper typing.
 */
declare global {
  interface Window {
    bodhiext?: BodhiExtPublicApi;
  }
}
