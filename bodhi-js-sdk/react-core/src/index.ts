/**
 * @bodhiapp/bodhi-js-react - React bindings for Bodhi SDK
 *
 * Public API exports - minimal surface area following industry best practices
 */

// Components, Context & Hooks
export {
  BodhiProvider,
  BodhiReactContext,
  useBodhi,
  type BodhiContext,
  type BodhiProviderProps,
  type SetupState,
} from './BodhiProvider';

// Marketing Components
export {
  BodhiBadge,
  type BodhiBadgeProps,
  type BodhiBadgeSize,
  type BodhiBadgeVariant,
} from './BodhiBadge';

// Types (only public-facing types)
export type { ClientContextState, ClientContextStatus } from './client-ctx';

// Constants
export { INITIAL_CLIENT_CONTEXT_STATE, INITIALIZING_CLIENT_CONTEXT_STATE } from './client-ctx';

// Type guards and utilities (from client-ctx - React-specific)
export {
  ClientCtxState,
  clientStateToContextState,
  isClientCtxInitialized,
  isClientCtxInitializing,
  isClientCtxNotInitialized,
  isClientCtxReady,
  isOverallReady,
} from './client-ctx';

// Re-exported types from core (internal monorepo package)
export type { ApiResponseResult, ClientState } from '@bodhiapp/bodhi-js-core';

// Re-exported utilities from core
export {
  isApiResultError,
  isApiResultOperationError,
  isApiResultSuccess,
  isDirectState,
  isExtensionState,
  isWebUIClient,
} from '@bodhiapp/bodhi-js-core';

// Error factories from core
export { createApiError, createOperationError } from '@bodhiapp/bodhi-js-core';

// Types (for type annotations)
export type { AuthState, UIClient } from '@bodhiapp/bodhi-js-core';

// Type guards and helpers (for auth state)
export {
  isAuthError,
  isAuthLoading,
  isAuthenticated,
  isClientReady,
} from '@bodhiapp/bodhi-js-core';

// Error types and guards (from bodhi-browser/types via core)
export { isOperationError, type OperationError } from '@bodhiapp/bodhi-js-core';

// Re-export build info
export { BUILD_MODE as REACT_CORE_BUILD_MODE } from './build-info';
