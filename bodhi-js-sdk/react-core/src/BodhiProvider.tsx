import {
  INITIAL_AUTH_STATE,
  Logger,
  NOOP_STATE_CALLBACK,
  isWebUIClient,
  type AuthState,
  type InitParams,
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
  login: () => Promise<AuthState | void>;
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
  const initAttemptedRef = useRef(false);
  const [clientState, setClientState] = useState<ClientContextState>(INITIAL_CLIENT_CONTEXT_STATE);
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [setupState, setSetupState] = useState<SetupState>('ready');

  // Set callback for state changes
  useEffect(() => {
    const onStateChange = (change: StateChange) => {
      switch (change.type) {
        case 'client-state':
          setClientState(clientStateToContextState(change.state));
          break;
        case 'auth-state':
          setAuth(change.state);
          setIsAuthLoading(false);
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
   * Auto-init on mount, then handle OAuth callback if present
   * Sequencing ensures connectionMode is restored before callback routing
   */
  useEffect(() => {
    // Only auto-init once on mount
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const initAndHandleCallback = async () => {
      // Step 1: Initialize client (restores connectionMode from storage)
      await init();

      // Step 2: Handle OAuth callback if present
      if (!handleCallback) return;

      const url = new URL(window.location.href);
      if (url.pathname !== callbackPath) return;

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return;
      if (callbackProcessedRef.current) return;

      callbackProcessedRef.current = true;

      if (isWebUIClient(client)) {
        setIsAuthLoading(true);
        client
          .handleOAuthCallback(code, state)
          .then(() => {
            // Auth state updated automatically via callback
            window.history.replaceState({}, '', basePath);
          })
          .catch((error: unknown) => {
            logger.error('OAuth callback failed:', error);
            setAuth({
              status: 'error',
              user: null,
              accessToken: null,
              error: {
                message: error instanceof Error ? error.message : 'OAuth callback failed',
                code: 'OAUTH_CALLBACK_FAILED',
              },
            });
            setIsAuthLoading(false);
            window.history.replaceState({}, '', basePath);
          });
      }
    };

    initAndHandleCallback();
  }, [init, client, handleCallback, callbackPath, basePath]);

  const login = useCallback(async (): Promise<AuthState | void> => {
    setIsAuthLoading(true);
    try {
      await client.login();
      // Auth state updated automatically via callback
    } catch (err) {
      const errorState: AuthState = {
        status: 'error',
        user: null,
        accessToken: null,
        error: {
          message: err instanceof Error ? err.message : 'Login failed',
          code: 'LOGIN_FAILED',
        },
      };
      setAuth(errorState);
      setIsAuthLoading(false);
      return errorState;
    }
  }, [client]);

  const logout = useCallback(async () => {
    try {
      await client.logout();
      // Auth state updated automatically via callback
    } catch (err) {
      setAuth({
        status: 'error',
        user: null,
        accessToken: null,
        error: {
          message: err instanceof Error ? err.message : 'Logout failed',
          code: 'LOGOUT_FAILED',
        },
      });
    }
  }, [client]);

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
