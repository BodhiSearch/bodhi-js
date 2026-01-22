/**
 * @bodhiapp/bodhi-js-core - Minimal shared types and interfaces
 *
 * This package contains the minimal shared code between ext and web SDKs:
 * - Types (ApiResponseResult, ClientState, UserInfo, etc.)
 * - Error factories (createApiError, createOperationError)
 * - Logger (centralized logging)
 * - UIClient interface (base interface)
 */

// Re-export types
export * from './types';

// Re-export constants
export * from './constants';

// Re-export logger
export * from './logger';

// Re-export interface
export * from './interface';

// Re-export platform
export * from './platform';

// Re-export storage
export * from './storage';

// Re-export onboarding
export * from './onboarding';

// Re-export oauth
export * from './oauth';

// Re-export toolset utilities
export * from './toolset-utils';

// Re-export direct client base
export * from './direct-client-base';

// Re-export facade
export * from './facade-client-base';

// Re-export OpenAI-compatible resources
export * from './openai-client-compat';

// Re-export error types from bodhi-browser (for type encapsulation)
export { isOperationError, type OperationError } from '@bodhiapp/bodhi-browser/types';

// Re-export build info
export { BUILD_MODE as CORE_BUILD_MODE } from './build-info';
