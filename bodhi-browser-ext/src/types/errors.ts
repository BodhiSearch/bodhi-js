/**
 * Error classes for the Bodhi extension public API
 *
 * BodhiError - Operational errors (network, timeout, extension-level)
 * BodhiApiError - HTTP 4xx/5xx errors from the server
 * unwrapResponse - Utility to extract body or throw on error status
 */

import type { OpenAiApiError } from '@bodhiapp/ts-client';
import type { ApiResponse } from './bodhiext';

/**
 * Error codes for BodhiError
 * Open-ended union allows custom codes via (string & {})
 */
export type BodhiErrorCode =
  | 'network_error'
  | 'timeout_error'
  | 'extension_error'
  | 'auth_error'
  | 'not_initialized'
  | 'connection_closed'
  | 'parse_error'
  | 'api_error'
  | (string & {}); // open-ended, allows custom codes

/**
 * Base error class for operational errors
 * (network unreachable, timeout, extension error, auth error)
 *
 * Use `instanceof BodhiError` to detect — no type guards needed.
 */
export class BodhiError extends Error {
  readonly code: BodhiErrorCode;

  constructor(code: BodhiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BodhiError';
    // Fix prototype chain for proper instanceof in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP API error (server returned 4xx/5xx)
 *
 * Use `instanceof BodhiApiError` to detect — no type guards needed.
 * Always has code = 'api_error'.
 */
export class BodhiApiError extends BodhiError {
  readonly status: number;
  readonly body: OpenAiApiError;
  readonly headers?: Record<string, string>;

  constructor(status: number, body: OpenAiApiError, message: string, headers?: Record<string, string>) {
    super('api_error', message);
    this.status = status;
    this.body = body;
    this.headers = headers;
    this.name = 'BodhiApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Extract response body or throw BodhiApiError if status >= 400
 */
export function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response.status >= 400) {
    const body = response.body as OpenAiApiError;
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new BodhiApiError(response.status, body, message, response.headers);
  }
  return response.body as T;
}
