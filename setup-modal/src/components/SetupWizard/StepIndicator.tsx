import { SetupStep } from '@/types';
import { CheckCircle, DownloadCloud, Laptop, Server, Wifi, XCircle } from 'lucide-react';
import { Fragment } from 'react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { selectStepStatus } from '@/store/selectors';

interface StepIndicatorProps {
  onStepClick: (step: SetupStep) => void;
}

export function StepIndicator({ onStepClick }: StepIndicatorProps) {
  const currentStep = useSetupModalStore(state => state.ui.currentStep);

  // Get step statuses using selector
  const platformStatus = useSetupModalStore(state => selectStepStatus(state, SetupStep.PLATFORM_CHECK));
  const serverStatus = useSetupModalStore(state => selectStepStatus(state, SetupStep.SERVER_SETUP));
  const lnaStatus = useSetupModalStore(state => selectStepStatus(state, SetupStep.LNA_SETUP));
  const extensionStatus = useSetupModalStore(state => selectStepStatus(state, SetupStep.EXTENSION_SETUP));
  const completeStatus = useSetupModalStore(state => selectStepStatus(state, SetupStep.COMPLETE));

  const steps = [
    {
      id: SetupStep.PLATFORM_CHECK,
      name: 'Platform',
      icon: <Laptop />,
      status: platformStatus,
    },
    {
      id: SetupStep.SERVER_SETUP,
      name: 'Server',
      icon: <Server />,
      status: serverStatus,
    },
    {
      id: SetupStep.LNA_SETUP,
      name: 'Direct',
      icon: <Wifi />,
      status: lnaStatus,
    },
    {
      id: SetupStep.EXTENSION_SETUP,
      name: 'Extension',
      icon: <DownloadCloud />,
      status: extensionStatus,
    },
    {
      id: SetupStep.COMPLETE,
      name: 'Complete',
      icon: <CheckCircle />,
      status: completeStatus,
    },
  ];

  const getStepVisuals = (step: (typeof steps)[0]) => {
    const isCurrent = currentStep === step.id;

    if (step.status === 'complete') {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-green-100 text-green-600',
        icon: <CheckCircle className="w-6 h-6" />,
        textClass: 'text-green-600',
        clickable: true,
      };
    }

    if (step.status === 'skipped') {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-400',
        icon: step.icon,
        textClass: 'text-gray-400 line-through',
        clickable: true,
      };
    }

    if (step.status === 'not-supported') {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-600',
        icon: <XCircle className="w-6 h-6" />,
        textClass: 'text-red-600',
        clickable: true,
      };
    }

    if (step.status === 'error') {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-600',
        icon: <XCircle className="w-6 h-6" />,
        textClass: 'text-red-600',
        clickable: true,
      };
    }

    if (step.status === 'warning') {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-amber-100 text-amber-600',
        icon: step.icon,
        textClass: 'text-amber-600',
        clickable: true,
      };
    }

    if (isCurrent) {
      return {
        circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-2 ring-blue-300',
        icon: step.icon,
        textClass: 'text-blue-600 font-medium',
        clickable: true,
      };
    }

    // Accessible but incomplete
    return {
      circleClass: 'w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 border-2 border-gray-200 hover:bg-gray-200 transition-colors',
      icon: step.icon,
      textClass: 'text-gray-500 hover:text-gray-700',
      clickable: true,
    };
  };

  return (
    <div className="flex items-center w-full">
      {steps.map((step, index) => {
        const visuals = getStepVisuals(step);

        return (
          <Fragment key={step.id}>
            <div
              className={`flex flex-col items-center ${visuals.clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
              data-testid={`step-${step.id}`}
              onClick={() => visuals.clickable && onStepClick(step.id)}
            >
              <div className={visuals.circleClass}>{visuals.icon}</div>
              <span className={`mt-2 text-xs ${visuals.textClass} transition-colors`}>{step.name}</span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  step.status === 'complete' && steps[index + 1].status === 'complete'
                    ? 'bg-green-300'
                    : step.status === 'complete'
                      ? 'bg-gradient-to-r from-green-300 to-gray-200'
                      : step.status === 'not-supported'
                        ? 'bg-gradient-to-r from-red-300 to-gray-200'
                        : 'bg-gray-200'
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
