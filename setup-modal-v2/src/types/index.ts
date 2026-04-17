export type { ProbeStatusV2, ServerStatusV2, BrowserInfoV2, SetupStateV2 } from './state';
export { DEFAULT_LOCAL_URL, CLOUD_URL, INSTALL_URL, DEFAULT_SETUP_STATE_V2 } from './state';

export type { MessageTypeRegistryV2, MessageTypeV2, RequestPayloadV2, ResponsePayloadV2, RequestHandlersV2 } from './messages';
export { MSG_V2, isMessageTypeV2 } from './messages';

export type {
  RequestIdV2,
  MessageKindV2,
  RequestMessageV2,
  ResponseMessageV2,
  ErrorMessageV2,
  EventMessageV2,
  ProtocolMessageV2,
} from './protocol';
export { isRequestMessageV2, isResponseMessageV2, isErrorMessageV2, isEventMessageV2 } from './protocol';

export { isProbeIdle, isProbing, isConnected, isNotReady, isProbeError, isNetworkError, isTerminalStatus } from './type-guards';
