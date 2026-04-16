/**
 * Error factory functions for creating throwable error instances
 *
 * These create BodhiError and BodhiApiError instances from bodhi-browser-ext types.
 * Parameter order matches the constructor signatures.
 */

import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-browser-types';
import type { BodhiErrorCode } from '@bodhiapp/bodhi-browser-types';
import type { BodhiErrorResponse } from '@bodhiapp/ts-client';

/**
 * Create API error (HTTP 4xx/5xx from server)
 * Extracts Error.message from body.error.message automatically.
 *
 * @param status - HTTP status code
 * @param body - Error body from server (Bodhi error format, superset of OpenAI)
 * @param headers - Optional response headers
 * @returns BodhiApiError instance
 */
export const createApiError = (
  status: number,
  body: BodhiErrorResponse,
  headers?: Record<string, string>
): BodhiApiError => {
  const message = body?.error?.message || `HTTP ${status}`;
  return new BodhiApiError(status, body, message, headers);
};

/**
 * Create operation error (network/extension level)
 * Thrown when HTTP request couldn't complete
 *
 * @param code - Error code (network_error, timeout_error, etc.)
 * @param message - Error message
 * @returns BodhiError instance
 */
export const createOperationError = (code: string, message: string): BodhiError => {
  return new BodhiError(code as BodhiErrorCode, message);
};

/**
 * Throw an appropriate BodhiError for access request denial/failure
 *
 * @param status - The access request status (denied, expired, or other)
 * @throws BodhiError always
 */
export function throwAccessRequestDenialError(status: string): never {
  if (status === 'denied')
    throw createOperationError('access_request_denied', 'Access request was denied');
  if (status === 'expired')
    throw createOperationError('access_request_expired', 'Access request expired');
  throw createOperationError('access_request_failed', `Access request failed: ${status}`);
}
