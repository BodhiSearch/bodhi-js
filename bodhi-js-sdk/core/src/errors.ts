/**
 * Error factory functions for creating throwable error instances
 *
 * These implementations are specific to bodhi-js-sdk/core.
 * The type definitions come from bodhi-browser-ext types.
 */

import type { ApiError, OperationError } from '@bodhiapp/bodhi-browser-types';

/**
 * Create API error (HTTP 4xx/5xx from server)
 * Thrown for streaming responses when server returns error
 *
 * @param message - Error message
 * @param status - HTTP status code
 * @param body - Error body from server
 * @param headers - Optional response headers
 * @returns ApiError instance
 */
export const createApiError = (
  message: string,
  status: number,

  body: any,
  headers?: Record<string, string>
): ApiError => {
  const error = new Error(message) as ApiError;

  error.response = { status, body: body as any, headers };
  return error;
};

/**
 * Create operation error (network/extension level)
 * Thrown when HTTP request couldn't complete
 *
 * @param message - Error message
 * @param type - Error type (network_error, timeout_error, etc.)
 * @returns OperationError instance
 */
export const createOperationError = (message: string, type: string): OperationError => {
  const error = new Error(message) as OperationError;
  error.error = { message, type };
  return error;
};
