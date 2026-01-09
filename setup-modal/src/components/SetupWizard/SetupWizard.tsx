import { StepIndicator } from '@/components/SetupWizard/StepIndicator';
import { ExtensionSetup } from '@/components/SetupWizard/Steps/ExtensionSetup';
import { LnaSetup } from '@/components/SetupWizard/Steps/LnaSetup';
import { LoadingSkeleton } from '@/components/SetupWizard/LoadingSkeleton';
import { PlatformCheck } from '@/components/SetupWizard/Steps/PlatformCheck';
import { ServerSetup } from '@/components/SetupWizard/Steps/ServerSetup';
import { SuccessState } from '@/components/SetupWizard/Steps/SuccessState';
import iconBase64Data from '@/icon.txt?raw';
import { SetupStep } from '@/types';
import { selectDeterminedStep, selectIsLoading, selectIsPlatformSupported } from '@/store/selectors';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function SetupWizard() {
  // Get state and actions from store
  const currentStep = useSetupModalStore(state => state.ui.currentStep);
  const isRefreshing = useSetupModalStore(state => state.ui.isRefreshing);
  const setCurrentStep = useSetupModalStore(state => state.setCurrentStep);
  const setIsRefreshing = useSetupModalStore(state => state.setIsRefreshing);
  const sendMessage = useSetupModalStore(state => state.sendMessage);

  // Ref to store timeout ID for cleanup
  const refreshTimeoutRef = useRef<number | null>(null);

  // Compute derived state using selectors
  const determinedStep = useSetupModalStore(selectDeterminedStep);
  const isPlatformSupported = useSetupModalStore(selectIsPlatformSupported);
  const isLoading = useSetupModalStore(selectIsLoading);
  const isPlatformNotSupported = !isPlatformSupported;

  // Sync currentStep from determinedStep (authoritative source)
  // determinedStep is computed from setupState, currentStep is UI state that follows it
  useEffect(() => {
    setCurrentStep(determinedStep);
  }, [determinedStep, setCurrentStep]);

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleStepClick = (step: SetupStep) => {
    // All steps are accessible for manual navigation
    setCurrentStep(step);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    sendMessage('modal:refresh', undefined).catch(err => {
      console.error('[SetupWizard] Refresh failed:', err);
    });

    // Clear any existing timeout before setting a new one
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Reset refreshing state after a delay (parent should handle actual state updates)
    refreshTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 2000);
  };

  const handleClose = () => {
    sendMessage('modal:close', undefined).catch(err => {
      console.error('[SetupWizard] Close failed:', err);
    });
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <img src={`data:image/png;base64,${iconBase64Data.trim()}`} alt="Bodhi Logo" className="w-8 h-8 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Bodhi Platform Setup</h2>
          {isLoading && (
            <div className="ml-3" data-testid="loading-indicator" title="Loading setup data...">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
          )}
          {isPlatformNotSupported && (
            <div className="ml-3" data-testid="platform-not-supported-indicator" title="Platform not supported - setup may not work">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded-full hover:bg-gray-100 ${isRefreshing ? 'bg-blue-50' : ''}`}
            title="Refresh detection"
            data-testid="refresh-button"
            data-refreshing={isRefreshing}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 hover:text-blue-600 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-100 hover:bg-red-50" title="Close modal" data-testid="close-button">
            <X className="w-4 h-4 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      </div>
      <div className="flex flex-col flex-1 p-4 min-h-0">
        <div className="flex-shrink-0">
          <StepIndicator onStepClick={handleStepClick} />
        </div>
        {/* Scrollable content area with proper height constraints */}
        <div className="mt-6 flex-1 overflow-y-auto min-h-0 w-full" data-testid="content-area">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {currentStep === SetupStep.PLATFORM_CHECK && <PlatformCheck />}
              {currentStep === SetupStep.SERVER_SETUP && <ServerSetup />}
              {currentStep === SetupStep.LNA_SETUP && <LnaSetup />}
              {currentStep === SetupStep.EXTENSION_SETUP && <ExtensionSetup />}
              {currentStep === SetupStep.COMPLETE && <SuccessState />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
