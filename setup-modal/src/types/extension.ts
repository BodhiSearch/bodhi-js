// Extension error codes
export type ExtensionErrorCode = 'ext-not-installed' | 'ext-connection-failed' | 'ext-unsupported-version';

// Extension error code constants
export const EXT_NOT_INSTALLED: ExtensionErrorCode = 'ext-not-installed';
export const EXT_CONNECTION_FAILED: ExtensionErrorCode = 'ext-connection-failed';
export const EXT_UNSUPPORTED_VERSION: ExtensionErrorCode = 'ext-unsupported-version';

// Extension state interfaces
export interface ExtensionStateReady {
  /** Current extension status */
  status: 'ready';
  /** Extension version */
  version: string;
  /** Extension ID (always present when ready) */
  id: string;
}

export interface ExtensionStateNotReady {
  /** Current extension status */
  status: 'unreachable' | 'not-installed' | 'unsupported';
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: ExtensionErrorCode;
  };
}

export type ExtensionState = ExtensionStateReady | ExtensionStateNotReady;
