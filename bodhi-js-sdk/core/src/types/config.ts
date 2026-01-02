/**
 * Configuration and utility types
 */

import type { UserScope } from './user-info';

/**
 * Log levels for client logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Extension discovery result
 */
export interface DiscoveryResult {
  success: boolean;
  extensionId?: string;
  error?: string;
}

/**
 * Client configuration
 */
export interface ClientConfig {
  authServerUrl?: string;
  userScope?: UserScope;
  extensionId?: string;
  logLevel?: LogLevel;
  discoveryAttempts?: number;
  discoveryAttemptWaitMs?: number;
  discoveryAttemptTimeout?: number;
}
