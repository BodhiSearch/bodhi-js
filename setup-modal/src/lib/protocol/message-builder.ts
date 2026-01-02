/**
 * MessageBuilder - Fluent API for creating type-safe protocol messages
 *
 * Provides static factory methods for constructing protocol messages
 * with full TypeScript type safety and inference.
 */

import { MessageType, RequestPayload, ResponsePayload, RequestId, RequestMessage, ResponseMessage, ErrorMessage, EventMessage } from '@/types';

/**
 * Fluent builder for creating protocol messages with type safety
 */
export class MessageBuilder {
  /**
   * Create a request message
   *
   * @param type - Message type from registry
   * @param payload - Typed payload for this message type
   * @returns RequestMessage with auto-generated requestId
   */
  static request<T extends MessageType>(type: T, payload: RequestPayload<T>): RequestMessage<T> {
    return {
      kind: 'request',
      type,
      requestId: crypto.randomUUID() as RequestId,
      payload,
    };
  }

  /**
   * Create a response message
   *
   * @param type - Message type from registry (must match request)
   * @param requestId - RequestId from the original request
   * @param payload - Typed response payload for this message type
   * @returns ResponseMessage correlating to the request
   */
  static response<T extends MessageType>(type: T, requestId: RequestId, payload: ResponsePayload<T>): ResponseMessage<T> {
    return {
      kind: 'response',
      type,
      requestId,
      payload,
    };
  }

  /**
   * Create an error response
   *
   * @param requestId - RequestId from the original request
   * @param error - Error details with code, message, and optional details
   * @returns ErrorMessage indicating request failure
   */
  static error(requestId: RequestId, error: { code: string; message: string; details?: unknown }): ErrorMessage {
    return {
      kind: 'error',
      requestId,
      error,
    };
  }

  /**
   * Create an event message (fire-and-forget)
   *
   * @param type - Message type from registry
   * @param payload - Typed payload for this message type
   * @returns EventMessage with no response expected
   */
  static event<T extends MessageType>(type: T, payload: RequestPayload<T>): EventMessage<T> {
    return {
      kind: 'event',
      type,
      payload,
    };
  }
}
