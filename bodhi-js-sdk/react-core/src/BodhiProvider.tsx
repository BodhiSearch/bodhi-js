import {
  BodhiError,
  INITIAL_AUTH_STATE,
  Logger,
  NOOP_STATE_CALLBACK,
  isWebUIClient,
  type AuthState,
  type InitParams,
  type LoginOptions,
  type LogLevel,
  type StateChange,
  type UIClient,
} from '@bodhiapp/bodhi-js-core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SetupModalProcessor } from './SetupModalProcessor';
import {
  clientStateToContextState,
  INITIAL_CLIENT_CONTEXT_STATE,
  INITIALIZING_CLIENT_CONTEXT_STATE,
  type ClientContextState,
} from './client-ctx';

export type SetupState = 'ready' | 'loading' | 'loaded';

export interface BodhiProviderProps {
  children: ReactNode;
  client: UIClient;
  modalHtmlPath?: string;
  handleCallback?: boolean;
  callbackPath?: string;
  basePath?: string;
  logLevel?: LogLevel;
}

export interface BodhiContext {
  client: UIClient;
  clientState: ClientContextState;
  setupState: SetupState;
  auth: AuthState;
  isAuthLoading: boolean;
  login: (options?: LoginOptions) => Promise<AuthState | void>;
  logout: () => Promise<void>;
  showSetup: () => Promise<void>;
  hideSetup: () => void;

  // Computed auth properties
  isAuthenticated: boolean;
  canLogin: boolean;

  // Computed connection properties
  isReady: boolean;
  isServerReady: boolean;
  isOverallReady: boolean;
  isInitializing: boolean;
  isExtension: boolean;
  isDirect: boolean;
}

export const BodhiReactContext = createContext<BodhiContext | null>(null);
BodhiReactContext.displayName = 'BodhiContext';

export function BodhiProvider({
  children,
  client,
  modalHtmlPath,
  handleCallback = true,
  callbackPath: userCallbackPath,
  basePath = '/',
  logLevel = 'warn',
}: BodhiProviderProps) {
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  const callbackPath = userCallbackPath ?? `${normalizedBasePath}/callback`;
  const logger = useMemo(() => new Logger('BodhiProvider', logLevel), [logLevel]);
  const callbackProcessedRef = useRef(false);
  const authErrorRef = useRef(false);
  const initAttemptedRef = useRef(false);
  const [clientState, setClientState] = useState<ClientContextState>(INITIAL_CLIENT_CONTEXT_STATE);
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [setupState, setSetupState] = useState<SetupState>('ready');

  const setAuthError = useCallback((code: string, message: string) => {
    authErrorRef.current = true;
    setAuth({
      status: 'error',
      user: null,
      accessToken: null,
      error: { code, message },
    });
    setIsAuthLoading(false);
  }, []);

  const clearAuthError = useCallback(() => {
    authErrorRef.current = false;
  }, []);

  // Set callback for state changes
  useEffect(() => {
    const onStateChange = (change: StateChange) => {
      switch (change.type) {
        case 'client-state':
          setClientState(clientStateToContextState(change.state));
          break;
        case 'auth-state':
          // Don't override error state set by callback handler
          // (async init refresh may emit unauthenticated after callback error)
          if (!authErrorRef.current) {
            setAuth(change.state);
            setIsAuthLoading(false);
          }
          break;
      }
    };

    client.setStateCallback(onStateChange);

    // Cleanup: set to no-op
    return () => {
      client.setStateCallback(NOOP_STATE_CALLBACK);
    };
  }, [client]);

  const showSetup = useCallback(async () => {
    setSetupState('loading');
  }, []);

  const hideSetup = useCallback(() => {
    setSetupState('ready');
  }, []);

  const onSetupReady = useCallback(() => {
    setSetupState('loaded');
  }, []);

  /**
   * Initialize client with optional params
   * Just pass through to client - facade handles all state management
   */
  const init = useCallback(
    async (params?: InitParams) => {
      setClientState(INITIALIZING_CLIENT_CONTEXT_STATE);
      try {
        await client.init(params || {});
        // State sync handled automatically by callback
      } catch (err) {
        logger.error('Init failed:', err);
        // State sync handled automatically by callback (error state from client)
      }
    },
    [client, logger]
  );

  /**
   * Auto-init on mount, then handle callbacks if present
   * Sequencing ensures connectionMode is restored before callback routing
   *
   * Callback flow (redirect login):
   *   1. Access request callback: ?bodhi_flow=access_request&id=<requestId>
   *      → polls status → approved → performOAuthPkce (page navigates away)
   *      → or denied/expired/failed → sets auth error state
   *   2. OAuth callback: ?code=<code>&state=<state>
   *      → exchanges code for tokens → authenticated
   */
  useEffect(() => {
    // Only auto-init once on mount
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const initAndHandleCallback = async () => {
      // Step 1: Initialize client (restores connectionMode from storage)
      await init();

      // Step 2: Handle callbacks if present
      if (!handleCallback) return;

      const url = new URL(window.location.href);
      if (url.pathname !== callbackPath) return;
      if (callbackProcessedRef.current) return;
      if (!isWebUIClient(client)) return;

      // Step 2a: Handle access request callback (redirect flow)
      // Detected by bodhi_flow=access_request marker (set by SDK in redirect URL)
      const bodhiFlow = url.searchParams.get('bodhi_flow');
      if (bodhiFlow === 'access_request') {
        const accessRequestId = url.searchParams.get('id');
        if (!accessRequestId) {
          logger.warn('Access request callback marker present but no id parameter');
          window.history.replaceState({}, '', basePath);
          return;
        }
        callbackProcessedRef.current = true;
        setIsAuthLoading(true);
        try {
          await client.handleAccessRequestCallback(accessRequestId);
          // handleAccessRequestCallback calls performOAuthPkce which navigates away
        } catch (error: unknown) {
          logger.error('Access request callback failed:', error);
          const bodhiError = error instanceof BodhiError ? error : null;
          setAuthError(
            bodhiError?.code ?? 'access_request_callback_failed',
            error instanceof Error ? error.message : 'Access request callback failed'
          );
          window.history.replaceState({}, '', basePath);
        }
        return;
      }

      // Step 2b: Handle OAuth callback (code exchange)
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return;

      callbackProcessedRef.current = true;
      setIsAuthLoading(true);
      try {
        await client.handleOAuthCallback(code, state);
        window.history.replaceState({}, '', basePath);
      } catch (error: unknown) {
        logger.error('OAuth callback failed:', error);
        const bodhiError = error instanceof BodhiError ? error : null;
        setAuthError(
          bodhiError?.code ?? 'oauth_callback_failed',
          error instanceof Error ? error.message : 'OAuth callback failed'
        );
        window.history.replaceState({}, '', basePath);
      }
    };

    initAndHandleCallback();
  }, [init, client, handleCallback, callbackPath, basePath]);

  const login = useCallback(
    async (options?: LoginOptions): Promise<AuthState | void> => {
      clearAuthError();
      setIsAuthLoading(true);
      try {
        // Defensively extract only valid LoginOptions properties
        // Handles React SyntheticEvent when used as onClick={login}
        const extracted = options
          ? {
              ...(options.userRole && { userRole: options.userRole }),
              ...(options.requested && { requested: options.requested }),
              ...(options.flowType && { flowType: options.flowType }),
              ...(options.redirectUrl && { redirectUrl: options.redirectUrl }),
              ...(options.onProgress && { onProgress: options.onProgress }),
              ...(options.pollIntervalMs && { pollIntervalMs: options.pollIntervalMs }),
              ...(options.pollTimeoutMs && { pollTimeoutMs: options.pollTimeoutMs }),
            }
          : undefined;
        const loginOptions = extracted && Object.keys(extracted).length > 0 ? extracted : undefined;

        await client.login(loginOptions);
        // Auth state updated automatically via callback
      } catch (err) {
        const bodhiError = err instanceof BodhiError ? err : null;
        const errorState: AuthState = {
          status: 'error',
          user: null,
          accessToken: null,
          error: {
            message: err instanceof Error ? err.message : 'Login failed',
            code: bodhiError?.code ?? 'login_failed',
          },
        };
        setAuth(errorState);
        setIsAuthLoading(false);
        return errorState;
      }
    },
    [client, clearAuthError]
  );

  const logout = useCallback(async () => {
    clearAuthError();
    try {
      await client.logout();
    } catch (err) {
      setAuthError('logout_failed', err instanceof Error ? err.message : 'Logout failed');
    }
  }, [client, setAuthError, clearAuthError]);

  const contextValue: BodhiContext = useMemo(() => {
    const isReady = clientState.status === 'ready';
    const isServerReady = clientState.server.status === 'ready';

    return {
      client,
      clientState,
      auth,
      isAuthLoading,
      login,
      logout,
      showSetup,
      hideSetup,
      setupState,

      // Computed auth properties
      isAuthenticated: auth.status === 'authenticated',
      canLogin: isReady && !isAuthLoading,

      // Computed connection properties
      isReady,
      isServerReady,
      isOverallReady: isReady && isServerReady,
      isInitializing: clientState.status === 'initializing',
      isExtension: clientState.mode === 'extension',
      isDirect: clientState.mode === 'direct',
    };
  }, [client, clientState, auth, isAuthLoading, setupState, login, logout, showSetup, hideSetup]);

  return (
    <BodhiReactContext.Provider value={contextValue}>
      <SetupModalProcessor
        client={client}
        modalHtmlPath={modalHtmlPath}
        hideSetup={hideSetup}
        onSetupReady={onSetupReady}
        setupState={setupState}
        basePath={basePath}
        logLevel={logLevel}
      />
      {children}
    </BodhiReactContext.Provider>
  );
}

export function useBodhi(): BodhiContext {
  const context = useContext(BodhiReactContext);
  if (!context) throw new Error('useBodhi must be used within BodhiProvider');
  return context;
}
