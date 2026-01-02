/**
 * @bodhiapp/bodhi-js-react - React bindings for Bodhi Browser SDK (Web preset)
 *
 * Preset package that auto-creates WebUIClient for simplified developer experience.
 * For advanced usage with custom client configuration, use @bodhiapp/bodhi-js-react-core.
 */

// Local exports - preset BodhiProvider
export { BodhiProvider, type BodhiProviderProps } from './BodhiProvider';

// Re-export WebUIClient and types for convenience
export { WebUIClient, type WebUIClientParams, type IWebUIClient } from '@bodhiapp/bodhi-js';

// Re-export everything from react-core
export {
  BodhiReactContext,
  useBodhi,
  type BodhiContext,
  type SetupState,
  type ClientContextState,
  type ClientContextStatus,
  INITIAL_CLIENT_CONTEXT_STATE,
  INITIALIZING_CLIENT_CONTEXT_STATE,
  ClientCtxState,
  clientStateToContextState,
  isClientCtxInitialized,
  isClientCtxInitializing,
  isClientCtxNotInitialized,
  isClientCtxReady,
  isOverallReady,
  type ApiResponseResult,
  type ClientState,
  type AuthState,
  type UIClient,
  type OperationError,
  isApiResultError,
  isApiResultOperationError,
  isApiResultSuccess,
  isDirectState,
  isExtensionState,
  isWebUIClient,
  isAuthError,
  isAuthLoading,
  isAuthenticated,
  isClientReady,
  isOperationError,
  createApiError,
  createOperationError,
} from '@bodhiapp/bodhi-js-react-core';

// Re-export build info
export { BUILD_MODE as REACT_BUILD_MODE } from './build-info';
