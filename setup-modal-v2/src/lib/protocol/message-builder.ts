import type {
  MessageTypeV2,
  RequestPayloadV2,
  ResponsePayloadV2,
  RequestIdV2,
  RequestMessageV2,
  ResponseMessageV2,
  ErrorMessageV2,
  EventMessageV2,
} from '@/types';

export class MessageBuilderV2 {
  static request<T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>): RequestMessageV2<T> {
    return {
      kind: 'request',
      type,
      requestId: crypto.randomUUID() as RequestIdV2,
      payload,
    };
  }

  static response<T extends MessageTypeV2>(type: T, requestId: RequestIdV2, payload: ResponsePayloadV2<T>): ResponseMessageV2<T> {
    return {
      kind: 'response',
      type,
      requestId,
      payload,
    };
  }

  static error(requestId: RequestIdV2, error: { code: string; message: string; details?: unknown }): ErrorMessageV2 {
    return {
      kind: 'error',
      requestId,
      error,
    };
  }

  static event<T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>): EventMessageV2<T> {
    return {
      kind: 'event',
      type,
      payload,
    };
  }
}
