import { useEffect, useState } from 'react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { selectIsLnaPathComplete, selectIsExtensionPathComplete } from '@/store/selectors';

/**
 * Hook for managing setup modal communication with parent window
 * Uses MessageChannel for type-safe bidirectional communication
 */
export function useSetupModal() {
  const setupState = useSetupModalStore(state => state.setupState);
  const setSetupState = useSetupModalStore(state => state.setSetupState);
  const initChannel = useSetupModalStore(state => state.initChannel);
  const sendMessage = useSetupModalStore(state => state.sendMessage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Set loading state when effect runs
    setIsReady(false);

    const channel = initChannel();

    // Listen for state updates from parent
    const unsubscribe = channel.on('parent:state-update', ({ setupState }) => {
      if (import.meta.env.DEV) {
        console.log('[useSetupModal] Received state update:', setupState);
      }
      setSetupState(setupState);
    });

    // Send ready message and get initial state
    sendMessage('modal:ready', undefined)
      .then(({ setupState }) => {
        if (import.meta.env.DEV) {
          console.log('[useSetupModal] Received initial state:', setupState);
        }
        setSetupState(setupState);
        setIsReady(true);
      })
      .catch(err => {
        console.error('[useSetupModal] Ready message failed:', err);
      });

    return () => {
      unsubscribe();
    };
  }, [initChannel, setSetupState, sendMessage]);

  // Auto-selection effect: triggers when connection paths become complete
  // Priority: LNA > Extension
  useEffect(() => {
    if (!setupState || setupState.selectedConnection !== null) return;

    const store = useSetupModalStore.getState();
    const lnaComplete = selectIsLnaPathComplete(store);
    const extComplete = selectIsExtensionPathComplete(store);

    if (lnaComplete) {
      if (import.meta.env.DEV) {
        console.log('[useSetupModal] Auto-selecting LNA connection');
      }
      sendMessage('modal:select-connection', { connection: 'lna' }).catch(err => {
        console.error('[useSetupModal] Auto-select LNA failed:', err);
      });
    } else if (extComplete) {
      if (import.meta.env.DEV) {
        console.log('[useSetupModal] Auto-selecting Extension connection');
      }
      sendMessage('modal:select-connection', { connection: 'extension' }).catch(err => {
        console.error('[useSetupModal] Auto-select Extension failed:', err);
      });
    }
  }, [setupState?.lna.status, setupState?.lnaServer.status, setupState?.extension.status, setupState?.server.status, setupState?.selectedConnection, sendMessage]);

  return { setupState, sendMessage, isReady };
}
