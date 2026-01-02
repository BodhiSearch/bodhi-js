/**
 * Authentication state and error types
 */

import type { UserInfo } from './user-info';

/**
 * Authentication status enum
 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

/**
 * Authentication error
 */
export interface AuthError {
  code: string;
  message: string;
}

/**
 * Authentication state (flat interface)
 */
export interface AuthState {
  status: AuthStatus;
  user: UserInfo | null;
  accessToken: string | null;
  error: AuthError | null;
}

/**
 * Helper to check if authenticated
 */
export function isAuthenticated(state: AuthState): boolean {
  return state.status === 'authenticated';
}

/**
 * Helper to check if loading
 */
export function isAuthLoading(state: AuthState): boolean {
  return state.status === 'loading';
}

/**
 * Helper to check if error
 */
export function isAuthError(state: AuthState): boolean {
  return state.status === 'error';
}

/**
 * Initial auth state
 */
export const INITIAL_AUTH_STATE: AuthState = {
  status: 'idle',
  user: null,
  accessToken: null,
  error: null,
};
