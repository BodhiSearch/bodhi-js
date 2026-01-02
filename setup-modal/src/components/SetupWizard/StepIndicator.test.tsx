import { StepIndicator } from '@/components/SetupWizard/StepIndicator';
import { SetupStep, DEFAULT_SETUP_STATE } from '@/types';
import { createMockState, createNotInstalledExtensionState, createReadyExtensionState, createReadyServerState, createUnreachableServerState } from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { useSetupModalStore } from '@/store/setup-modal-store';

describe('StepIndicator - Server Setup Step Status', () => {
  beforeEach(() => {
    useSetupModalStore.setState({ setupState: DEFAULT_SETUP_STATE });
  });

  const serverSetupStatusCases = [
    {
      name: 'incomplete (grey) when serverInstall false',
      state: createMockState({ userConfirmations: { serverInstall: false } }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-gray-100',
    },
    {
      name: 'current (blue) when active step and serverInstall false',
      state: createMockState({ userConfirmations: { serverInstall: false } }),
      currentStep: SetupStep.SERVER_SETUP,
      expectedClass: 'bg-blue-100',
    },
    {
      name: 'complete (green) when serverInstall true',
      state: createMockState({ userConfirmations: { serverInstall: true } }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-green-100',
    },
  ];

  test.each(serverSetupStatusCases)('should show $name', ({ state, currentStep, expectedClass }) => {
    useSetupModalStore.setState({ setupState: state, ui: { ...useSetupModalStore.getState().ui, currentStep } });
    render(<StepIndicator onStepClick={vi.fn()} />);
    const serverStep = screen.getByTestId('step-server-setup');
    const iconContainer = serverStep.querySelector('div > div');
    expect(iconContainer).toHaveClass(expectedClass);
  });
});

describe('StepIndicator - Extension Setup Step Status', () => {
  beforeEach(() => {
    useSetupModalStore.setState({ setupState: DEFAULT_SETUP_STATE });
  });

  const extensionSetupStatusCases = [
    {
      name: 'incomplete (grey) when extension not ready',
      state: createMockState({ extension: createNotInstalledExtensionState() }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-gray-100',
    },
    {
      name: 'incomplete (grey) when extension ready but server not ready (setup state)',
      state: createMockState({
        extension: createReadyExtensionState(),
        server: { status: 'setup', version: '1.0.0', error: { message: 'Setup required', code: 'server-in-setup-status' } },
      }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-gray-100',
    },
    {
      name: 'current (blue) when active step',
      state: createMockState({ extension: createNotInstalledExtensionState() }),
      currentStep: SetupStep.EXTENSION_SETUP,
      expectedClass: 'bg-blue-100',
    },
    {
      name: 'complete (green) when both extension and server ready',
      state: createMockState({
        extension: createReadyExtensionState(),
        server: createReadyServerState(),
      }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-green-100',
    },
    {
      name: 'error (red) when extension ready but server unreachable',
      state: createMockState({
        extension: createReadyExtensionState(),
        server: createUnreachableServerState(),
      }),
      currentStep: SetupStep.PLATFORM_CHECK,
      expectedClass: 'bg-red-100',
    },
  ];

  test.each(extensionSetupStatusCases)('should show $name', ({ state, currentStep, expectedClass }) => {
    useSetupModalStore.setState({ setupState: state, ui: { ...useSetupModalStore.getState().ui, currentStep } });
    render(<StepIndicator onStepClick={vi.fn()} />);
    const extensionStep = screen.getByTestId('step-extension-setup');
    const iconContainer = extensionStep.querySelector('div > div');
    expect(iconContainer).toHaveClass(expectedClass);
  });
});
