import {
  isOpenAiApiErrorBody,
  isOperationErrorStructure,
  type ApiResponse,
  type OperationErrorResponse,
} from '@bodhiapp/bodhi-browser/types';
import { OpenAiApiError } from '@bodhiapp/ts-client';

/**
 * Public API result type - discriminated union without protocol fields
 *
 * This is the return type for sendApiRequest() and similar methods.
 * Unlike ApiResponseMessage<T> (which includes type and requestId for internal routing),
 * this is the clean public interface without protocol overhead.
 *
 * Usage:
 *   if ('error' in result) → { error: OperationErrorResponse } (network/extension error)
 *   if ('body' in result) → ApiResponse<T> (HTTP completed - check status for success/error)
 */
export type ApiResponseResult<T> = ApiResponse<T> | { error: OperationErrorResponse };

/**
 * Type guard for operation error response
 */
export function isApiResultOperationError<T>(
  result: ApiResponseResult<T>
): result is { error: OperationErrorResponse } {
  return (
    result !== null &&
    typeof result === 'object' &&
    'error' in result &&
    !('body' in result) &&
    isOperationErrorStructure(result.error)
  );
}

/**
 * Type guard for API response (success or HTTP error)
 */
export function isApiResultSuccess<T>(
  result: ApiResponseResult<T>
): result is ApiResponse<T> & { body: T; status: number } {
  return (
    'body' in result &&
    'status' in result &&
    typeof result.status === 'number' &&
    result.status >= 200 &&
    result.status < 300
  );
}

export function isApiResultError<T>(
  result: ApiResponseResult<T>
): result is ApiResponse<OpenAiApiError> & { body: OpenAiApiError; status: number } {
  return (
    'body' in result &&
    'status' in result &&
    typeof result.status === 'number' &&
    result.status >= 400 &&
    isOpenAiApiErrorBody(result.body)
  );
}
