/**
 * @bodhiapp/bodhi-js-react-ext - React bindings for Bodhi Browser SDK (Extension preset)
 *
 * Preset package that auto-creates ExtUIClient for simplified developer experience in Chrome extensions.
 * For advanced usage with custom client configuration, use @bodhiapp/bodhi-js-react-core.
 */

// Local exports - preset BodhiProvider
export { BodhiProvider, type BodhiProviderProps } from './BodhiProvider';

// Re-export ExtUIClient and BodhiExtClient for convenience
export { ExtUIClient, type ExtUIClientParams, BodhiExtClient } from '@bodhiapp/bodhi-js-ext';

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
export { BUILD_MODE as REACT_EXT_BUILD_MODE } from './build-info';
export { EXT_BUILD_MODE } from '@bodhiapp/bodhi-js-ext';
