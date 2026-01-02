import { SetupWizard } from '@/components/SetupWizard/SetupWizard';
import { useSetupModal } from '@/hooks/useSetupModal';

export function App() {
  // Hook handles postMessage communication and updates store
  // isReady indicates useEffect has completed and state is initialized
  const { isReady } = useSetupModal();

  return (
    <div className="w-full h-screen bg-white" data-testid="div-setup-modal" data-test-state={isReady ? 'ready' : 'loading'}>
      <SetupWizard />
    </div>
  );
}
