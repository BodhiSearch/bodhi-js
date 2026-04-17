import { useSetupModalV2 } from '@/hooks/useSetupModalV2';
import { Header } from '@/components/Header';
import { SetupScreen } from '@/components/SetupScreen';

export function App() {
  const { setupState, sendMessage, isReady } = useSetupModalV2();

  return (
    <div
      className="flex flex-col h-full bg-white"
      data-testid="div-setup-modal-v2"
      data-test-state={isReady ? 'ready' : 'loading'}
      data-test-probe-status={setupState.probeStatus}
    >
      <Header sendMessage={sendMessage} />
      <div className="flex-1 overflow-y-auto min-h-0">
        <SetupScreen setupState={setupState} sendMessage={sendMessage} />
      </div>
    </div>
  );
}
