/**
 * SetupModalProcessor - Business logic layer for setup modal
 *
 * Owns all domain logic for setup modal:
 * - State building from client
 * - Connectivity testing via UIClient
 * - Preference management
 * - Handler callbacks for modal messages
 *
 * Headless component that manages OnboardingModal lifecycle.
 */

import type { UIClient } from '@bodhiapp/bodhi-js-core';
import {
  BROWSER_CONFIGS,
  BodhiClientUserPrefsManager,
  Logger,
  OS_CONFIGS,
  OnboardingModal,
  createStoragePrefixWithBasePath,
  detectBrowser,
  detectOS,
  getServerUrl,
  isDirectServerReady,
  isExtensionServerReady,
  type AsyncRequestHandlers,
  type ConnectionMode,
  type DirectState,
  type ExtensionState,
  type LogLevel,
} from '@bodhiapp/bodhi-js-core';
import type * as ModalTypes from '@bodhiapp/setup-modal-types';
import { MSG, DEFAULT_SETUP_STATE } from '@bodhiapp/setup-modal-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SetupState } from './BodhiProvider';

interface SetupModalProcessorProps {
  client: UIClient;
  modalHtmlPath?: string;
  hideSetup: () => void;
  onSetupReady?: () => void;
  setupState: SetupState;
  basePath?: string;
  logLevel?: LogLevel;
}

/**
 * SetupModalProcessor - Headless React component managing setup modal business logic
 */
export function SetupModalProcessor({
  client,
  modalHtmlPath,
  hideSetup,
  onSetupReady,
  setupState,
  basePath = '/',
  logLevel = 'warn',
}: SetupModalProcessorProps) {
  const isVisible = setupState !== 'ready';
  const logger = useMemo(() => new Logger('SetupModalProcessor', logLevel), [logLevel]);
  const modalRef = useRef<OnboardingModal | null>(null);
  const prefs = useMemo(
    () => new BodhiClientUserPrefsManager(createStoragePrefixWithBasePath(basePath, 'bodhijs:')),
    [basePath]
  );
  const currentStateRef = useRef<ModalTypes.SetupState | null>(null);

  // ============================================================================
  // Simplified State Mapping Methods
  // ============================================================================

  /**
   * Map client ConnectionMode to modal's selectedConnection
   */
  const mapConnectionMode = useCallback(
    (mode: ConnectionMode | null): ModalTypes.SelectedConnection => {
      if (mode === 'direct') return 'lna';
      if (mode === 'extension') return 'extension';
      return null;
    },
    []
  );

  /**
   * Map SDK ExtensionState to modal's ExtensionState (1:1 mapping)
   */
  const mapExtension = useCallback((state: ExtensionState): ModalTypes.ExtensionState => {
    if (state.extension === 'ready') {
      return {
        status: 'ready',
        version: 'unknown', // TODO: have ExtensionState also get extension version
        id: state.extensionId!,
      };
    } else if (state.extension === 'not-found') {
      return {
        status: 'not-installed',
        error: { message: 'Extension not found', code: 'ext-not-installed' },
      };
    } else {
      // should not happen, as we call initialize before calling mapExtension
      return {
        status: 'unreachable',
        error: { message: 'Client not initialized', code: 'ext-connection-failed' },
      };
    }
  }, []);

  /**
   * Map SDK ExtensionState server to modal's ServerState
   */
  const mapServer = useCallback((state: ExtensionState): ModalTypes.ServerState => {
    if (state.server.status === 'pending-extension-ready') {
      return {
        status: 'pending-extension-ready',
        error: { message: 'Extension not ready', code: 'server-pending-ext-ready' },
      };
    }

    const serverState = state.server;
    switch (serverState.status) {
      case 'ready':
        return { status: 'ready', version: serverState.version || 'unknown' };
      case 'setup':
        return {
          status: 'setup',
          version: serverState.version || 'unknown',
          error: {
            message: serverState.error?.message || 'Setup required',
            code: 'server-in-setup-status',
          },
        };
      case 'resource_admin':
        return {
          status: 'resource_admin',
          version: serverState.version || 'unknown',
          error: {
            message: serverState.error?.message || 'Resource admin required',
            code: 'server-in-admin-status',
          },
        };
      case 'error':
        return {
          status: 'error',
          error: {
            message: serverState.error?.message || 'Unknown error',
            code: 'server-unexpected-error',
          },
        };
      case 'not-reachable':
        return {
          status: 'unreachable',
          error: {
            message: serverState.error?.message || 'Server not reachable',
            code: 'server-conn-refused',
          },
        };
      default:
        // TODO: 'not-connected' status impossible here - extension server can't have this status
        // SetupState is built from BackendServerState, so this path will never be reached.
        // Future cleanup: Consider separate ExtensionServerStatus vs DirectServerStatus types.
        return {
          status: 'unreachable',
          error: {
            message: 'Unknown server status',
            code: 'server-unexpected-error',
          },
        };
    }
  }, []);

  /**
   * Map DirectState to modal's LnaServerState
   */
  const mapLnaServer = useCallback((state: DirectState): ModalTypes.LnaServerState => {
    if (state.server.status === 'not-connected') {
      return { status: 'pending-lna-ready' };
    }

    const serverState = state.server;
    switch (serverState.status) {
      case 'ready':
        return { status: 'ready', version: serverState.version || 'unknown' };
      case 'setup':
        return { status: 'setup', version: serverState.version || 'unknown' };
      case 'resource_admin':
        return { status: 'resource_admin', version: serverState.version || 'unknown' };
      case 'error':
      case 'not-reachable':
        return {
          status: 'error',
          error: { message: serverState.error?.message || 'Connection error' },
        };
      default:
        // TODO: 'pending-extension-ready' status impossible here - direct server can't have this status
        // SetupState is built from BackendServerState, so this path will never be reached.
        // Future cleanup: Consider separate ExtensionServerStatus vs DirectServerStatus types.
        return {
          status: 'error',
          error: { message: 'Unknown server status' },
        };
    }
  }, []);

  /**
   * Check if server is reachable (installed) based on extension or direct state
   * Returns true for ready, setup, or resource_admin statuses
   */
  const isServerReachable = useCallback(
    (extensionState: ExtensionState, directState: DirectState): boolean => {
      // Check extension server
      if (extensionState.server.status !== 'pending-extension-ready') {
        const status = extensionState.server.status;
        if (status === 'ready' || status === 'setup' || status === 'resource_admin') {
          return true;
        }
      }

      // Check direct server
      if (directState.server.status !== 'not-connected') {
        const status = directState.server.status;
        if (status === 'ready' || status === 'setup' || status === 'resource_admin') {
          return true;
        }
      }

      return false;
    },
    []
  );

  /**
   * Build LNA state from directState + prefs
   * Derives LNA state instead of hardcoding 'prompt'
   */
  const buildLnaState = useCallback(
    (
      directState: DirectState,
      directStatus: 'granted' | 'skipped' | 'denied' | null,
      serverUrl: string
    ): ModalTypes.LnaState => {
      // If user skipped, return skipped state
      if (directStatus === 'skipped') {
        return { status: 'skipped', serverUrl };
      }

      // If directState is initialized (tested), derive from server status
      if (directState.server.status !== 'not-connected') {
        const serverState = directState.server;
        if (
          serverState.status === 'ready' ||
          serverState.status === 'setup' ||
          serverState.status === 'resource_admin'
        ) {
          return { status: 'granted', serverUrl };
        } else {
          // not-reachable or error
          return {
            status: 'unreachable',
            serverUrl,
            error: {
              message: serverState.error?.message || 'Server unreachable',
              code: 'lna-unreachable',
            },
          };
        }
      }

      // Not tested yet - check prefs for previous grant
      if (directStatus === 'granted') {
        // Previously granted but not yet tested this session
        return { status: 'granted', serverUrl };
      }

      // Default: prompt user
      return { status: 'prompt', serverUrl };
    },
    []
  );

  /**
   * Build SetupState using new getExtensionState() and getDirectState()
   * Handles not-initialized cases by triggering connectivity tests
   * @param forceRefresh - If true, force fresh connectivity tests (used by MODAL_REFRESH)
   */
  const buildSetupState = useCallback(
    async (forceRefresh = false): Promise<ModalTypes.SetupState> => {
      const browser = detectBrowser().type;
      const os = detectOS().type;

      // Extension state - always test on refresh, or if not-initialized
      let extensionState = await client.getExtensionState();
      if (extensionState.extension === 'not-initialized' || forceRefresh) {
        extensionState = await client.testExtensionConnectivity();
      }

      // Direct state - test if directStatus === 'granted' (user previously granted LNA)
      let directState = await client.getDirectState();
      const directStatus = prefs.getDirectStatus();

      const shouldTestDirect =
        directStatus === 'granted' &&
        (directState.server.status === 'not-connected' || forceRefresh);

      if (shouldTestDirect) {
        directState = await client.testDirectConnectivity();
      }

      const defaultServerUrl = getServerUrl(directState) || 'http://localhost:1135';

      // Build lna state from directState + prefs (no longer hardcoded 'prompt')
      const lna = buildLnaState(directState, directStatus, defaultServerUrl);

      // Auto-select connectionMode if null (fresh install)
      // Priority: direct first (lower latency), then extension
      if (client.getConnectionMode() === null) {
        if (isDirectServerReady(directState)) {
          await client.setConnectionMode('direct');
        } else if (isExtensionServerReady(extensionState)) {
          await client.setConnectionMode('extension');
        }
      }

      // Auto-detect server installation: if user hasn't confirmed manually,
      // but we can reach server, auto-confirm for them
      if (!prefs.isServerInstallConfirmed()) {
        if (isServerReachable(extensionState, directState)) {
          prefs.setServerInstallConfirmed(true);
        }
      }

      return {
        extension: mapExtension(extensionState),
        server: mapServer(extensionState),
        lna,
        lnaServer: mapLnaServer(directState),
        env: { browser, os },
        browsers: BROWSER_CONFIGS,
        os: OS_CONFIGS,
        userConfirmations: { serverInstall: prefs.isServerInstallConfirmed() },
        selectedConnection: mapConnectionMode(client.getConnectionMode()),
      };
    },
    [
      client,
      prefs,
      mapExtension,
      mapServer,
      mapLnaServer,
      mapConnectionMode,
      buildLnaState,
      isServerReachable,
    ]
  );

  /**
   * Get state with cached overrides applied
   * Applies overrides for values that may change outside buildSetupState
   */
  const getStateWithOverrides = useCallback((): ModalTypes.SetupState => {
    if (!currentStateRef.current) {
      throw new Error('Cannot get state: currentStateRef is null');
    }

    return {
      ...currentStateRef.current,
      // Override userConfirmations from storage (in case updated outside buildSetupState)
      userConfirmations: {
        serverInstall: prefs.isServerInstallConfirmed(),
      },
      // Override selectedConnection from client (in case changed via handler)
      selectedConnection: mapConnectionMode(client.getConnectionMode()),
    };
  }, [prefs, client, mapConnectionMode]);

  // ============================================================================
  // Handler Map - uses UIClient for all connectivity testing
  // ============================================================================

  const handlers = useMemo<AsyncRequestHandlers>(
    () => ({
      [MSG.MODAL_READY]: async () => {
        logger.info('MODAL_READY: returning current state or default');
        if (currentStateRef.current) {
          return { setupState: getStateWithOverrides() };
        }
        // Return DEFAULT_SETUP_STATE while building (modal already has this but be explicit)
        return { setupState: DEFAULT_SETUP_STATE };
      },

      [MSG.MODAL_REFRESH]: async () => {
        logger.info('MODAL_REFRESH: refreshing state');
        const state = await buildSetupState(true); // Force refresh
        currentStateRef.current = state;
        const finalState = getStateWithOverrides();
        logger.info('MODAL_REFRESH: state refreshed\n', JSON.stringify(finalState, null, 2));
        modalRef.current?.updateState(getStateWithOverrides());
        return { setupState: finalState };
      },

      [MSG.MODAL_LNA_CONNECT]: async (msg) => {
        const serverUrl = msg.payload.serverUrl;
        console.log('[SetupModalProcessor] LNA connect:', serverUrl);

        // Test direct connectivity
        const directState = await client.testDirectConnectivity(serverUrl);

        if (directState.server.status !== 'not-connected') {
          const serverStatus = directState.server.status;
          if (
            serverStatus === 'ready' ||
            serverStatus === 'setup' ||
            serverStatus === 'resource_admin'
          ) {
            // Connection succeeded
            prefs.setDirectStatus('granted');

            // Auto-select direct if connectionMode is null
            if (client.getConnectionMode() === null) {
              await client.setConnectionMode('direct');
            }

            // Rebuild and update modal state
            const state = await buildSetupState();
            currentStateRef.current = state;
            modalRef.current?.updateState(getStateWithOverrides());
            return { success: true };
          }
        }

        // Connection failed - rebuild state to show error
        const state = await buildSetupState();
        currentStateRef.current = state;
        modalRef.current?.updateState(getStateWithOverrides());
        return { success: false };
      },

      [MSG.MODAL_LNA_SKIP]: async () => {
        prefs.setDirectStatus('skipped');

        // Rebuild state to reflect skipped status
        const state = await buildSetupState();
        currentStateRef.current = state;
        modalRef.current?.updateState(getStateWithOverrides());
        return { success: true };
      },

      [MSG.MODAL_CLOSE]: () => {
        hideSetup();
        return undefined;
      },

      [MSG.MODAL_COMPLETE]: () => {
        hideSetup();
        return undefined;
      },

      [MSG.MODAL_CONFIRM_SERVER_INSTALL]: (msg) => {
        prefs.setServerInstallConfirmed(msg.payload.confirmed);
        modalRef.current?.updateState(getStateWithOverrides());
        return { success: true };
      },

      [MSG.MODAL_SELECT_CONNECTION]: async (msg) => {
        const connection = msg.payload.connection;
        const mode = connection === 'lna' ? 'direct' : 'extension';
        // Call client.setConnectionMode() directly - persists via facade
        await client.setConnectionMode(mode);
        modalRef.current?.updateState(getStateWithOverrides());
        return { success: true };
      },
    }),
    [logger, client, prefs, buildSetupState, getStateWithOverrides, mapLnaServer, hideSetup]
  );

  // ============================================================================
  // Modal Lifecycle
  // ============================================================================

  useEffect(() => {
    modalRef.current = new OnboardingModal({ modalHtmlPath, handlers });
    return () => {
      modalRef.current?.destroy();
      modalRef.current = null;
    };
  }, [modalHtmlPath, handlers]);

  useEffect(() => {
    if (isVisible && modalRef.current) {
      // Show modal immediately with loading state
      modalRef.current.showLoading();

      // Then build actual state asynchronously
      buildSetupState(true)
        .then((state) => {
          currentStateRef.current = state;
          modalRef.current?.updateState(state);
          onSetupReady?.();
        })
        .catch((error) => {
          console.error('[SetupModalProcessor] buildSetupState failed:', error);
        });
    } else if (!isVisible && modalRef.current) {
      modalRef.current.destroy();
    }
  }, [isVisible, buildSetupState, onSetupReady]);

  return null; // Headless component
}
