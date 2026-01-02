import type {
  MessageType,
  RequestPayload,
  ResponsePayload,
  RequestMessage,
  RequestId,
} from '@bodhiapp/setup-modal/types';

/** Build fire-and-forget event message */
export function buildEvent<T extends MessageType>(type: T, payload: RequestPayload<T>) {
  return { kind: 'event' as const, type, payload };
}

/** Build response message with requestId correlation */
export function buildResponse<T extends MessageType>(
  requestId: RequestId,
  type: T,
  payload: ResponsePayload<T>
) {
  return { kind: 'response' as const, type, requestId, payload };
}

/** Build error message */
export function buildError(
  requestId: RequestId,
  error: { code: string; message: string; details?: unknown }
) {
  return { kind: 'error' as const, requestId, error };
}

/** Type-safe request handler - processes incoming requests and returns response */
export function handleRequest<T extends MessageType>(
  message: RequestMessage<T>,
  handlers: Partial<{ [K in MessageType]: (payload: RequestPayload<K>) => ResponsePayload<K> }>
): ReturnType<typeof buildResponse> | null {
  const handler = handlers[message.type];
  if (!handler) return null;
  const response = handler(message.payload);
  return buildResponse(message.requestId, message.type, response);
}
