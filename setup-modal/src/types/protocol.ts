/**
 * Core protocol types for setup-modal ↔ parent communication
 *
 * Design principles:
 * - Type-safe request/response correlation
 * - Discriminated unions for message kinds
 * - Branded types for ID safety
 * - Full TypeScript inference from MessageTypeRegistry
 */

import type { MessageType, RequestPayload, ResponsePayload } from './message-types';

/** Branded type for type-safe request IDs */
export type RequestId = string & { readonly __brand: 'RequestId' };

/** Message kind discriminator */
export type MessageKind = 'request' | 'response' | 'error' | 'event';

/**
 * Request message - expects a response
 * Sent by either modal or parent to request an action
 */
export interface RequestMessage<T extends MessageType = MessageType> {
  readonly kind: 'request';
  readonly type: T;
  readonly requestId: RequestId;
  readonly payload: RequestPayload<T>;
}

/**
 * Response message - correlates to a request
 * Sent in response to a RequestMessage with matching requestId
 */
export interface ResponseMessage<T extends MessageType = MessageType> {
  readonly kind: 'response';
  readonly type: T;
  readonly requestId: RequestId;
  readonly payload: ResponsePayload<T>;
}

/**
 * Error response - indicates request failure
 * Sent instead of ResponseMessage when request cannot be fulfilled
 */
export interface ErrorMessage {
  readonly kind: 'error';
  readonly requestId: RequestId;
  readonly error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Event message - fire-and-forget notification
 * No response expected, used for one-way state updates
 */
export interface EventMessage<T extends MessageType = MessageType> {
  readonly kind: 'event';
  readonly type: T;
  readonly payload: RequestPayload<T>;
}

/**
 * Union of all protocol messages
 * Discriminated by 'kind' field for type narrowing
 */
export type ProtocolMessage = RequestMessage | ResponseMessage | ErrorMessage | EventMessage;

/**
 * Type guard to check if message is a request
 */
export function isRequestMessage(msg: ProtocolMessage): msg is RequestMessage {
  return msg.kind === 'request';
}

/**
 * Type guard to check if message is a response
 */
export function isResponseMessage(msg: ProtocolMessage): msg is ResponseMessage {
  return msg.kind === 'response';
}

/**
 * Type guard to check if message is an error
 */
export function isErrorMessage(msg: ProtocolMessage): msg is ErrorMessage {
  return msg.kind === 'error';
}

/**
 * Type guard to check if message is an event
 */
export function isEventMessage(msg: ProtocolMessage): msg is EventMessage {
  return msg.kind === 'event';
}
