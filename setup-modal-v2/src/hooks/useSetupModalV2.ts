import { useEffect, useState } from 'react';
import { useSetupModalV2Store } from '@/store/setup-modal-v2-store';

export function useSetupModalV2() {
  const setupState = useSetupModalV2Store(state => state.setupState);
  const setSetupState = useSetupModalV2Store(state => state.setSetupState);
  const initChannel = useSetupModalV2Store(state => state.initChannel);
  const sendMessage = useSetupModalV2Store(state => state.sendMessage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
    const channel = initChannel();

    const unsubscribe = channel.on('parent:state-update', setupStateUpdate => {
      if (import.meta.env.DEV) {
        console.log('[useSetupModalV2] state update:', setupStateUpdate);
      }
      setSetupState(setupStateUpdate);
    });

    sendMessage('modal:ready', undefined)
      .then(({ setupState: initial }) => {
        if (import.meta.env.DEV) {
          console.log('[useSetupModalV2] initial state:', initial);
        }
        setSetupState(initial);
        setIsReady(true);
      })
      .catch(err => {
        console.error('[useSetupModalV2] modal:ready failed:', err);
        setIsReady(true);
      });

    return () => {
      unsubscribe();
    };
  }, [initChannel, setSetupState, sendMessage]);

  return { setupState, sendMessage, isReady };
}
