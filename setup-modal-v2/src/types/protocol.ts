/**
 * Protocol envelope types - shared by v2 modal and host SDK.
 *
 * Mirrors v1's envelope shape so existing SDK infrastructure (e.g., message
 * validation on the host side) continues to work.
 */

import type { MessageTypeV2, RequestPayloadV2, ResponsePayloadV2 } from './messages';

export type RequestIdV2 = string & { readonly __brand: 'RequestIdV2' };

export type MessageKindV2 = 'request' | 'response' | 'error' | 'event';

export interface RequestMessageV2<T extends MessageTypeV2 = MessageTypeV2> {
  readonly kind: 'request';
  readonly type: T;
  readonly requestId: RequestIdV2;
  readonly payload: RequestPayloadV2<T>;
}

export interface ResponseMessageV2<T extends MessageTypeV2 = MessageTypeV2> {
  readonly kind: 'response';
  readonly type: T;
  readonly requestId: RequestIdV2;
  readonly payload: ResponsePayloadV2<T>;
}

export interface ErrorMessageV2 {
  readonly kind: 'error';
  readonly requestId: RequestIdV2;
  readonly error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface EventMessageV2<T extends MessageTypeV2 = MessageTypeV2> {
  readonly kind: 'event';
  readonly type: T;
  readonly payload: RequestPayloadV2<T>;
}

export type ProtocolMessageV2 = RequestMessageV2 | ResponseMessageV2 | ErrorMessageV2 | EventMessageV2;

export function isRequestMessageV2(msg: ProtocolMessageV2): msg is RequestMessageV2 {
  return msg.kind === 'request';
}

export function isResponseMessageV2(msg: ProtocolMessageV2): msg is ResponseMessageV2 {
  return msg.kind === 'response';
}

export function isErrorMessageV2(msg: ProtocolMessageV2): msg is ErrorMessageV2 {
  return msg.kind === 'error';
}

export function isEventMessageV2(msg: ProtocolMessageV2): msg is EventMessageV2 {
  return msg.kind === 'event';
}
