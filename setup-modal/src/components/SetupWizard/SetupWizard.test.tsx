import { SetupWizard } from '@/components/SetupWizard/SetupWizard';
import { SetupStep, DEFAULT_SETUP_STATE } from '@/types';
import {
  createAllSystemsReadyState,
  createExtensionNotInstalledState,
  createMockState,
  createNotInstalledExtensionState,
  createResourceAdminServerState,
  createSetupServerState,
  createUnreachableExtensionState,
  createUnsupportedPlatformState,
  createReadyServerState,
  createPendingServerState,
  createReadyExtensionState,
  createUnreachableServerState,
} from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useSetupModalStore } from '@/store/setup-modal-store';

const mockSendAction = vi.fn();

describe('SetupWizard - Step Navigation', () => {
  beforeEach(() => {
    mockSendAction.mockClear();
    // Reset store state before each test
    useSetupModalStore.setState({ setupState: DEFAULT_SETUP_STATE });
  });

  test('should show loading state with DEFAULT_SETUP_STATE', () => {
    // DEFAULT_SETUP_STATE has empty browsers/os arrays, triggering loading skeleton
    render(<SetupWizard />);

    // Should show loading skeleton during initial load
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Detecting platform...')).toBeInTheDocument();
  });

  // Parameterized tests for step navigation logic
  describe('Step Navigation Logic', () => {
    const stepNavigationTestCases = [
      {
        name: 'unsupported browser (firefox) with macos -> Platform Check',
        state: createUnsupportedPlatformState('firefox', 'macos'),
        expectedStep: SetupStep.PLATFORM_CHECK,
        expectedText: 'Platform Compatibility Check',
      },
      {
        name: 'unsupported OS (linux) with chrome -> Platform Check',
        state: createUnsupportedPlatformState('chrome', 'linux'),
        expectedStep: SetupStep.PLATFORM_CHECK,
        expectedText: 'Platform Compatibility Check',
      },
      {
        name: 'both unsupported (firefox + linux) -> Platform Check',
        state: createUnsupportedPlatformState('firefox', 'linux'),
        expectedStep: SetupStep.PLATFORM_CHECK,
        expectedText: 'Platform Compatibility Check',
      },
      {
        name: 'server pending-extension-ready -> Server Setup (confirmation)',
        state: createExtensionNotInstalledState(),
        expectedStep: SetupStep.SERVER_SETUP,
        expectedText: 'I have installed the Bodhi App Server',
      },
      {
        name: 'supported platform + extension not-installed + server ready -> Extension Setup',
        state: createMockState({
          extension: createNotInstalledExtensionState(),
          server: createReadyServerState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.EXTENSION_SETUP,
        expectedText: 'Extension is not installed',
      },
      {
        name: 'supported platform + extension unreachable -> Extension Setup',
        state: createMockState({
          extension: createUnreachableExtensionState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.EXTENSION_SETUP,
        expectedText: 'Could not connect to extension',
      },
      {
        name: 'supported platform + extension ready + server unreachable -> Extension Setup (server accordion)',
        state: createMockState({
          extension: createReadyExtensionState(),
          server: createUnreachableServerState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.EXTENSION_SETUP,
        expectedText: 'Server Status',
      },
      {
        name: 'supported platform + extension ready + server in setup -> Extension Setup (server accordion)',
        state: createMockState({
          server: createSetupServerState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.EXTENSION_SETUP,
        expectedText: 'Action Required',
      },
      {
        name: 'supported platform + extension ready + server resource-admin -> Extension Setup (server accordion)',
        state: createMockState({
          server: createResourceAdminServerState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.EXTENSION_SETUP,
        expectedText: 'Action Required',
      },
      {
        name: 'all systems ready -> Complete',
        state: createMockState({
          extension: createReadyExtensionState(),
          server: createReadyServerState(),
          userConfirmations: { serverInstall: true },
        }),
        expectedStep: SetupStep.COMPLETE,
        expectedText: 'All Systems Ready!',
      },
    ];

    test.each(stepNavigationTestCases)(
      'should navigate to correct step: $name',
      ({ state, expectedStep, expectedText }: { state: ReturnType<typeof createMockState>; expectedStep: SetupStep; expectedText: string }) => {
        useSetupModalStore.setState({ setupState: state });
        render(<SetupWizard />);

        // Should not show loading indicator when state is provided
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

        // Should show expected step content
        expect(screen.getByText(expectedText)).toBeInTheDocument();

        // Should have correct step indicator active
        const stepElement = screen.getByTestId(`step-${expectedStep}`);
        expect(stepElement).toBeInTheDocument();
      }
    );
  });

  describe('Server Pending State Navigation', () => {
    test('should navigate to Server Setup when server is pending and user has not confirmed', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createPendingServerState(),
        userConfirmations: { serverInstall: false },
      });
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      expect(screen.getByTestId('step-server-setup')).toBeInTheDocument();
      expect(screen.getByText('I have installed the Bodhi App Server')).toBeInTheDocument();
    });

    test('should skip Server Setup and go to Extension Setup when server is pending but user has confirmed', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createPendingServerState(),
        userConfirmations: { serverInstall: true },
      });
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      expect(screen.getByTestId('step-extension-setup')).toBeInTheDocument();
      expect(screen.getByText('Extension is not installed')).toBeInTheDocument();
    });

    test('should navigate to Extension Setup when extension not ready but server is not pending and server install confirmed', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createReadyServerState(),
        userConfirmations: { serverInstall: true },
      });
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      expect(screen.getByTestId('step-extension-setup')).toBeInTheDocument();
      expect(screen.getByText('Extension is not installed')).toBeInTheDocument();
    });

    test('should navigate to Server Setup when server is ready but user has not confirmed installation', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createReadyServerState(),
        userConfirmations: { serverInstall: false },
      });
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      expect(screen.getByTestId('step-server-setup')).toBeInTheDocument();
      expect(screen.getByText('I have installed the Bodhi App Server')).toBeInTheDocument();
    });
  });

  describe('Platform Not Supported Indicator', () => {
    const platformNotSupportedCases = [
      {
        name: 'unsupported browser shows not supported indicator',
        state: createUnsupportedPlatformState('firefox', 'macos'),
        shouldShow: true,
      },
      {
        name: 'unsupported OS shows not supported indicator',
        state: createUnsupportedPlatformState('chrome', 'linux'),
        shouldShow: true,
      },
      {
        name: 'both unsupported shows not supported indicator',
        state: createUnsupportedPlatformState('firefox', 'linux'),
        shouldShow: true,
      },
      {
        name: 'supported platform does not show not supported indicator',
        state: createAllSystemsReadyState(),
        shouldShow: false,
      },
    ];

    test.each(platformNotSupportedCases)('$name', ({ state, shouldShow }: { state: ReturnType<typeof createMockState>; shouldShow: boolean }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      const indicator = screen.queryByTestId('platform-not-supported-indicator');

      if (shouldShow) {
        expect(indicator).toBeInTheDocument();
      } else {
        expect(indicator).not.toBeInTheDocument();
      }
    });
  });

  describe('User Interactions', () => {
    test('should call sendMessage when refresh button clicked', async () => {
      const user = userEvent.setup();
      const state = createMockState();
      const sendMessageSpy = vi.fn().mockResolvedValue({ setupState: state });
      useSetupModalStore.setState({
        setupState: state,
        sendMessage: sendMessageSpy,
      });
      render(<SetupWizard />);

      const refreshButton = screen.getByTestId('refresh-button');
      await user.click(refreshButton);

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:refresh', undefined);
    });

    test('should call sendMessage when close button clicked', async () => {
      const user = userEvent.setup();
      const state = createMockState();
      const sendMessageSpy = vi.fn().mockResolvedValue(undefined);
      useSetupModalStore.setState({
        setupState: state,
        sendMessage: sendMessageSpy,
      });
      render(<SetupWizard />);

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:close', undefined);
    });

    test('should allow manual step navigation', async () => {
      const user = userEvent.setup();
      const state = createAllSystemsReadyState();
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      // Should start on Complete step
      expect(screen.getByText('All Systems Ready!')).toBeInTheDocument();

      // Click on Platform Check step
      const platformStep = screen.getByTestId('step-platform-check');
      await user.click(platformStep);

      // Should navigate to Platform Check
      expect(screen.getByText('Platform Compatibility Check')).toBeInTheDocument();
    });
  });

  describe('Step Indicator Count', () => {
    test('should always show 4 step indicators', () => {
      const state = createMockState();
      useSetupModalStore.setState({ setupState: state });
      render(<SetupWizard />);

      expect(screen.getByTestId('step-platform-check')).toBeInTheDocument();
      expect(screen.getByTestId('step-server-setup')).toBeInTheDocument();
      expect(screen.getByTestId('step-extension-setup')).toBeInTheDocument();
      expect(screen.getByTestId('step-complete')).toBeInTheDocument();
    });
  });
});
