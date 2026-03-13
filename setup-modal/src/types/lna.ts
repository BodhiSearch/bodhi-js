// LNA error codes
export type LnaErrorCode = 'lna-unreachable' | 'lna-permission-denied';

// LNA error code constants
export const LNA_UNREACHABLE: LnaErrorCode = 'lna-unreachable';
export const LNA_PERMISSION_DENIED: LnaErrorCode = 'lna-permission-denied';

// LNA (Local Network Access) state interfaces
// Aligned with browser permission API states: prompt, granted, denied
export interface LnaStatePrompt {
  status: 'prompt';
  serverUrl?: string; // For URL input default from localStorage
}

export interface LnaStateSkipped {
  status: 'skipped';
  serverUrl?: string; // For URL input default from localStorage
}

export interface LnaStateGranted {
  status: 'granted';
  serverUrl: string;
}

export interface LnaStateUnreachable {
  status: 'unreachable';
  serverUrl: string;
  error: {
    message: string;
    code: LnaErrorCode;
  };
}

export interface LnaStateDenied {
  status: 'denied';
  error: {
    message: string;
    code: LnaErrorCode;
  };
}

export interface LnaStateUnsupported {
  status: 'unsupported';
}

export type LnaState = LnaStatePrompt | LnaStateSkipped | LnaStateGranted | LnaStateUnreachable | LnaStateDenied | LnaStateUnsupported;

// LNA Server state interfaces
export interface LnaServerStatePending {
  status: 'pending-lna-ready';
}

export interface LnaServerStateReady {
  status: 'ready';
  version: string;
}

export interface LnaServerStateSetup {
  status: 'setup';
  version: string;
}

export interface LnaServerStateResourceAdmin {
  status: 'resource_admin';
  version: string;
}

export interface LnaServerStateTenantSelection {
  status: 'tenant_selection';
  version: string;
}

export interface LnaServerStateError {
  status: 'error';
  error: {
    message: string;
  };
}

export type LnaServerState = LnaServerStatePending | LnaServerStateReady | LnaServerStateSetup | LnaServerStateResourceAdmin | LnaServerStateTenantSelection | LnaServerStateError;
