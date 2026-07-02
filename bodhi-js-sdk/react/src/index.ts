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
  type SetupModalVariant,
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
  type ClientState,
  type AuthState,
  type LoginOptions,
  type LoginProgressCallback,
  type LoginProgressStage,
  type UIClient,
  type LogLevel,
  type BodhiErrorCode,
  type ApiResponse,
  LoginOptionsBuilder,
  BodhiError,
  BodhiApiError,
  unwrapResponse,
  isDirectState,
  isExtensionState,
  isWebUIClient,
  isAuthError,
  isAuthLoading,
  isAuthenticated,
  isClientReady,
  createApiError,
  createOperationError,
  BodhiBadge,
  type BodhiBadgeProps,
  type BodhiBadgeSize,
  type BodhiBadgeVariant,
  InMemoryStorage,
  type IStorage,
  type InitialTokens,
  type StreamTextResult,
  normalizeServerUrl,
} from '@bodhiapp/bodhi-js-react-core';

// Re-export build info
export { BUILD_MODE as REACT_BUILD_MODE } from './build-info';
export { WEB_BUILD_MODE } from '@bodhiapp/bodhi-js';
