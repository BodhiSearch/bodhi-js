import type { UIClient } from '@bodhiapp/bodhi-js-core';
import {
  BodhiClientUserPrefsManager,
  Logger,
  OnboardingModalV2,
  createStoragePrefixWithNamespace,
  type AsyncRequestHandlersV2,
  type LogLevel,
} from '@bodhiapp/bodhi-js-core';
import type { BrowserInfoV2, SetupStateV2 } from '@bodhiapp/setup-modal-v2-types';
import { DEFAULT_LOCAL_URL, MSG_V2 } from '@bodhiapp/setup-modal-v2-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SetupState } from './BodhiProvider';

interface SetupModalV2ProcessorProps {
  client: UIClient;
  modalHtmlPath?: string;
  hideSetup: () => void;
  onSetupReady?: () => void;
  setupState: SetupState;
  basePath?: string;
  logLevel?: LogLevel;
  autoProbe?: boolean;
}

const LNA_MIN_CHROME = 130;
const LNA_MIN_EDGE = 143;

function detectBrowserV2(ua: string = navigator.userAgent): BrowserInfoV2 {
  const lowered = ua.toLowerCase();
  const edgeMatch = lowered.match(/edg\/(\d+)/);
  if (edgeMatch) {
    const version = parseInt(edgeMatch[1], 10);
    return { name: 'edge', version, supported: version >= LNA_MIN_EDGE };
  }
  const chromeMatch = lowered.match(/chrome\/(\d+)/);
  if (chromeMatch && !lowered.includes('edg/')) {
    const version = parseInt(chromeMatch[1], 10);
    return { name: 'chrome', version, supported: version >= LNA_MIN_CHROME };
  }
  const firefoxMatch = lowered.match(/firefox\/(\d+)/);
  if (firefoxMatch)
    return { name: 'firefox', version: parseInt(firefoxMatch[1], 10), supported: false };
  const safariMatch = lowered.match(/version\/(\d+).*safari/);
  if (safariMatch && !lowered.includes('chrome/'))
    return { name: 'safari', version: parseInt(safariMatch[1], 10), supported: false };
  return { name: 'unknown', version: 0, supported: false };
}

interface CachedConnectionV2 {
  serverUrl: string;
  lastProbedAt: number;
}

export function SetupModalV2Processor({
  client,
  modalHtmlPath,
  hideSetup,
  onSetupReady,
  setupState,
  basePath = '/',
  logLevel = 'warn',
  autoProbe = true,
}: SetupModalV2ProcessorProps) {
  const isVisible = setupState !== 'ready';
  const logger = useMemo(() => new Logger('SetupModalV2Processor', logLevel), [logLevel]);
  const modalRef = useRef<OnboardingModalV2 | null>(null);
  const currentStateRef = useRef<SetupStateV2 | null>(null);
  const prefs = useMemo(
    () => new BodhiClientUserPrefsManager(createStoragePrefixWithNamespace(basePath, 'bodhijs:')),
    [basePath]
  );
  const cacheKey = useMemo(
    () => `${createStoragePrefixWithNamespace(basePath, 'bodhijs:')}setup-v2.connection`,
    [basePath]
  );

  const readCache = useCallback((): CachedConnectionV2 | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.serverUrl === 'string') return parsed as CachedConnectionV2;
      return null;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (serverUrl: string) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ serverUrl, lastProbedAt: Date.now() } satisfies CachedConnectionV2)
        );
      } catch {
        // Non-fatal
      }
    },
    [cacheKey]
  );

  const probeServer = useCallback(
    async (serverUrl: string): Promise<SetupStateV2> => {
      const browser = detectBrowserV2();
      const directState = await client.testDirectConnectivity(serverUrl);
      const status = directState.server.status;

      if (status === 'ready') {
        writeCache(serverUrl);
        prefs.setDirectStatus('granted');
        if (client.getConnectionMode() === null) {
          await client.setConnectionMode('direct');
        }
        return { serverUrl, browser, probeStatus: 'connected', serverStatus: 'ready' };
      }

      if (status === 'setup' || status === 'resource_admin') {
        return { serverUrl, browser, probeStatus: 'not-ready', serverStatus: status };
      }

      if (status === 'error') {
        return {
          serverUrl,
          browser,
          probeStatus: 'error',
          serverStatus: 'error',
          error: directState.server.error
            ? { code: 'server-error', message: directState.server.error.message }
            : undefined,
        };
      }

      return {
        serverUrl,
        browser,
        probeStatus: 'network-error',
        serverStatus: 'unreachable',
        error: directState.server.error
          ? { code: 'network-error', message: directState.server.error.message }
          : undefined,
      };
    },
    [client, prefs, writeCache]
  );

  const buildInitialState = useCallback(async (): Promise<SetupStateV2> => {
    const cached = readCache();
    const urlToProbe = cached?.serverUrl ?? DEFAULT_LOCAL_URL;
    return probeServer(urlToProbe);
  }, [probeServer, readCache]);

  const handlers = useMemo<AsyncRequestHandlersV2>(
    () => ({
      [MSG_V2.MODAL_READY]: async () => {
        if (currentStateRef.current) {
          return { setupState: currentStateRef.current };
        }
        const state = await buildInitialState();
        currentStateRef.current = state;
        return { setupState: state };
      },
      [MSG_V2.MODAL_PROBE]: async (msg) => {
        const state = await probeServer(msg.payload.serverUrl);
        currentStateRef.current = state;
        modalRef.current?.updateState(state);
        return { setupState: state };
      },
      [MSG_V2.MODAL_COMPLETE]: () => {
        hideSetup();
        return undefined;
      },
      [MSG_V2.MODAL_CLOSE]: () => {
        hideSetup();
        return undefined;
      },
    }),
    [buildInitialState, probeServer, hideSetup]
  );

  // Modal lifecycle
  useEffect(() => {
    modalRef.current = new OnboardingModalV2({ modalHtmlPath, handlers });
    return () => {
      modalRef.current?.destroy();
      modalRef.current = null;
    };
  }, [modalHtmlPath, handlers]);

  // Effect 1: Eager headless probe on mount
  useEffect(() => {
    if (!autoProbe) return;
    buildInitialState()
      .then((state) => {
        currentStateRef.current = state;
        logger.info('Auto-probe complete:', state.probeStatus);
      })
      .catch((error) => {
        logger.error('Auto-probe failed:', error);
      });
  }, [autoProbe, buildInitialState, logger]);

  // Effect 2: Modal visibility
  useEffect(() => {
    let cancelled = false;

    if (isVisible && modalRef.current) {
      modalRef.current.showLoading();

      if (currentStateRef.current) {
        modalRef.current.updateState(currentStateRef.current);
        onSetupReady?.();
      } else {
        buildInitialState()
          .then((state) => {
            if (cancelled) return;
            currentStateRef.current = state;
            modalRef.current?.updateState(state);
            onSetupReady?.();
          })
          .catch((error) => {
            if (cancelled) return;
            logger.error('buildInitialState failed:', error);
          });
      }
    } else if (!isVisible && modalRef.current) {
      modalRef.current.destroy();
    }

    return () => {
      cancelled = true;
    };
  }, [isVisible, buildInitialState, onSetupReady, logger]);

  return null;
}
