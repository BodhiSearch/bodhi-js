import type { SetupStateV2 } from './state';

export interface MessageTypeRegistryV2 {
  'modal:ready': {
    request: void;
    response: { setupState: SetupStateV2 };
  };

  'modal:probe': {
    request: { serverUrl: string };
    response: { setupState: SetupStateV2 };
  };

  'modal:complete': {
    request: void;
    response: void;
  };

  'modal:close': {
    request: void;
    response: void;
  };

  'parent:state-update': {
    request: SetupStateV2;
    response: void;
  };
}

export type MessageTypeV2 = keyof MessageTypeRegistryV2;

export type RequestPayloadV2<T extends MessageTypeV2> = MessageTypeRegistryV2[T]['request'];

export type ResponsePayloadV2<T extends MessageTypeV2> = MessageTypeRegistryV2[T]['response'];

export const MSG_V2 = {
  MODAL_READY: 'modal:ready',
  MODAL_PROBE: 'modal:probe',
  MODAL_COMPLETE: 'modal:complete',
  MODAL_CLOSE: 'modal:close',
  PARENT_STATE_UPDATE: 'parent:state-update',
} as const;

export type RequestHandlersV2 = {
  [K in MessageTypeV2]?: (msg: {
    type: K;
    requestId: string;
    payload: RequestPayloadV2<K>;
  }) => ResponsePayloadV2<K> | Promise<ResponsePayloadV2<K>>;
};

export function isMessageTypeV2<T extends MessageTypeV2>(msg: { type: string }, type: T): msg is { type: T } {
  return msg.type === type;
}
