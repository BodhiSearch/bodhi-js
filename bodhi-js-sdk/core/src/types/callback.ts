import type { ClientState } from './client-state';
import type { AuthState } from './auth';

/**
 * Discriminated union for state changes.
 * Allows single callback to handle both client state and auth state changes.
 */
export type ClientStateChange = { type: 'client-state'; state: ClientState };
export type AuthStateChange = { type: 'auth-state'; state: AuthState };
export type StateChange = ClientStateChange | AuthStateChange;

/**
 * Callback invoked when client state or auth state changes.
 * Defaults to no-op if not provided.
 */
export type StateChangeCallback = (change: StateChange) => void;

/** No-op callback for clients created without listener */
export const NOOP_STATE_CALLBACK: StateChangeCallback = () => {};
