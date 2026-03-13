/**
 * Consolidated types for setup-modal
 *
 * This folder contains all domain and protocol types organized by domain.
 * It is designed to be independent and copyable to other packages.
 */

// Platform types
export type { BrowserType, OSType, EnvState, SupportedBrowser, NotSupportedBrowser, Browser, SupportedOS, NotSupportedOS, OS } from './platform';

// Extension types
export type { ExtensionErrorCode, ExtensionStateReady, ExtensionStateNotReady, ExtensionState } from './extension';
export { EXT_NOT_INSTALLED, EXT_CONNECTION_FAILED, EXT_UNSUPPORTED_VERSION } from './extension';

// Server types
export type { ServerErrorCode, ServerStateReady, ServerStateReachable, ServerStatePending, ServerStateUnreachable, ServerStateError, ServerState } from './server';
export {
  SERVER_PENDING_EXT_READY,
  SERVER_CONN_REFUSED,
  SERVER_CONN_TIMEOUT,
  SERVER_NOT_FOUND,
  SERVER_NETWORK_UNREACHABLE,
  SERVER_SERVICE_UNAVAILABLE,
  SERVER_UNEXPECTED_ERROR,
  SERVER_IN_SETUP_STATUS,
  SERVER_IN_ADMIN_STATUS,
  SERVER_IN_TENANT_SELECTION_STATUS,
} from './server';

// LNA types
export type {
  LnaErrorCode,
  LnaStatePrompt,
  LnaStateSkipped,
  LnaStateGranted,
  LnaStateUnreachable,
  LnaStateDenied,
  LnaStateUnsupported,
  LnaState,
  LnaServerStatePending,
  LnaServerStateReady,
  LnaServerStateSetup,
  LnaServerStateResourceAdmin,
  LnaServerStateTenantSelection,
  LnaServerStateError,
  LnaServerState,
} from './lna';
export { LNA_UNREACHABLE, LNA_PERMISSION_DENIED } from './lna';

// State types
export { SetupStep, DEFAULT_USER_CONFIRMATIONS, DEFAULT_SETUP_STATE } from './state';
export type { SelectedConnection, UserConfirmations, SetupState } from './state';

// Protocol types
export type { RequestId, MessageKind, RequestMessage, ResponseMessage, ErrorMessage, EventMessage, ProtocolMessage } from './protocol';
export { isRequestMessage, isResponseMessage, isErrorMessage, isEventMessage } from './protocol';

// Message types
export type { MessageTypeRegistry, MessageType, RequestPayload, ResponsePayload, RequestHandlers } from './message-types';
export { MSG, isMessageType } from './message-types';

// Type guards
export {
  isExtensionStateReady,
  isExtensionStateNotReady,
  isServerStateReady,
  isServerStateReachable,
  isServerStatePending,
  isServerStateUnreachable,
  isServerStateError,
  isLnaStatePrompt,
  isLnaStateSkipped,
  isLnaStateGranted,
  isLnaStateUnreachable,
  isLnaStateDenied,
  isLnaStateUnsupported,
  isLnaServerStatePending,
  isLnaServerStateReady,
  isLnaServerStateSetup,
  isLnaServerStateResourceAdmin,
  isLnaServerStateTenantSelection,
  isLnaServerStateError,
  isSupportedBrowser,
  isNotSupportedBrowser,
  isSupportedOS,
  isNotSupportedOS,
} from './type-guards';
