// Server error codes
export type ServerErrorCode =
  | 'server-pending-ext-ready'
  | 'server-conn-refused'
  | 'server-conn-timeout'
  | 'server-not-found'
  | 'server-network-unreachable'
  | 'server-service-unavailable'
  | 'server-unexpected-error'
  | 'server-in-setup-status'
  | 'server-in-admin-status';

// Server error code constants
export const SERVER_PENDING_EXT_READY: ServerErrorCode = 'server-pending-ext-ready';
export const SERVER_CONN_REFUSED: ServerErrorCode = 'server-conn-refused';
export const SERVER_CONN_TIMEOUT: ServerErrorCode = 'server-conn-timeout';
export const SERVER_NOT_FOUND: ServerErrorCode = 'server-not-found';
export const SERVER_NETWORK_UNREACHABLE: ServerErrorCode = 'server-network-unreachable';
export const SERVER_SERVICE_UNAVAILABLE: ServerErrorCode = 'server-service-unavailable';
export const SERVER_UNEXPECTED_ERROR: ServerErrorCode = 'server-unexpected-error';
export const SERVER_IN_SETUP_STATUS: ServerErrorCode = 'server-in-setup-status';
export const SERVER_IN_ADMIN_STATUS: ServerErrorCode = 'server-in-admin-status';

// Server state interfaces
export interface ServerStateReady {
  /** Current server status */
  status: 'ready';
  /** Server version */
  version: string;
}

export interface ServerStateReachable {
  /** Current server status */
  status: 'setup' | 'resource-admin';
  /** Server version */
  version: string;
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: ServerErrorCode;
  };
}

export interface ServerStatePending {
  /** Current server status */
  status: 'pending-extension-ready';
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: ServerErrorCode;
  };
}

export interface ServerStateUnreachable {
  /** Current server status */
  status: 'unreachable';
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: ServerErrorCode;
  };
}

export interface ServerStateError {
  /** Current server status */
  status: 'error';
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: ServerErrorCode;
  };
}

export type ServerState = ServerStateReady | ServerStateReachable | ServerStatePending | ServerStateUnreachable | ServerStateError;
