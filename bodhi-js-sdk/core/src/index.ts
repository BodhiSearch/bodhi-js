/**
 * @bodhiapp/bodhi-js-core - Minimal shared types and interfaces
 *
 * This package contains the minimal shared code between ext and web SDKs:
 * - Types (ClientState, UserInfo, BodhiError, etc.)
 * - Error factories (createApiError, createOperationError)
 * - Logger (centralized logging)
 * - UIClient interface (base interface)
 */

// Re-export types
export * from './types';

// Re-export login option utilities
export * from './login-options';

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
export * from './oauth-callback';
export * from './oauth-token-exchange';
export * from './login-flow';

// Re-export direct client base
export * from './direct-client-base';

// Re-export concrete headless direct client (worker/server/test use, token injection)
export * from './direct-client';

// Re-export facade
export * from './facade-client-base';

// Re-export OpenAI-compatible resources
export * from './openai-client-compat';

// Re-export MCP fetch adapters
export { createDirectMcpFetch, createExtensionMcpFetch } from './mcp-fetch';

// Note: BodhiError, BodhiApiError, unwrapResponse, BodhiErrorCode are re-exported via ./types

// Re-export build info
export { BUILD_MODE as CORE_BUILD_MODE } from './build-info';
