import { SuccessState } from '@/components/SetupWizard/Steps/SuccessState';
import {
  createAllSystemsReadyState,
  createExtensionNotInstalledState,
  createLnaPromptState,
  createLnaGrantedState,
  createLnaServerReadyState,
  createLnaSkippedState,
  createMockState,
  createReadyExtensionState,
  createReadyServerState,
  createServerNotReadyState,
  createUnreachableExtensionState,
  createUnsupportedPlatformState,
} from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useSetupModalStore } from '@/store/setup-modal-store';

const mockSendAction = vi.fn();

describe('SuccessState - Completion Status Display', () => {
  beforeEach(() => {
    mockSendAction.mockClear();
    useSetupModalStore.setState({
      setupState: undefined,
    });
  });

  describe('Overall Status Display', () => {
    const overallStatusCases = [
      {
        name: 'all systems ready shows success state',
        state: createAllSystemsReadyState(),
        expectedTitle: 'All Systems Ready!',
        expectedDescription: 'Your Bodhi Platform setup is complete and ready to use.',
        shouldShowContinueButton: true,
        expectedIcon: 'success', // Green checkmark
      },
      {
        name: 'incomplete setup shows in-progress state',
        state: createExtensionNotInstalledState(),
        expectedTitle: 'Setup In Progress',
        expectedDescription: 'Complete the remaining setup steps to get started.',
        shouldShowContinueButton: false,
        expectedIcon: 'warning', // Amber clock
      },
      {
        name: 'unsupported platform shows in-progress state',
        state: createUnsupportedPlatformState('firefox', 'linux'),
        expectedTitle: 'Setup In Progress',
        expectedDescription: 'Complete the remaining setup steps to get started.',
        shouldShowContinueButton: false,
        expectedIcon: 'warning',
      },
    ];

    test.each(overallStatusCases)('should $name', ({ state, expectedTitle, expectedDescription, shouldShowContinueButton }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      // Should show correct title and description
      expect(screen.getByTestId('success-state-title')).toHaveTextContent(expectedTitle);
      expect(screen.getByTestId('success-state-description')).toHaveTextContent(expectedDescription);

      // Should conditionally show continue button
      if (shouldShowContinueButton) {
        expect(screen.getByTestId('continue-button')).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId('continue-button')).not.toBeInTheDocument();
      }
    });
  });

  describe('Setup Status Summary', () => {
    test('should show platform compatibility status for supported platform', () => {
      const state = createMockState({
        env: { browser: 'chrome', os: 'macos' },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('status-summary-title')).toHaveTextContent('Setup Status Summary');
      expect(screen.getByTestId('platform-status-label')).toHaveTextContent('Platform Compatibility');
      expect(screen.getByTestId('platform-status-details')).toHaveTextContent('Chrome on macOS');

      // Should show Ready status for all components
      expect(screen.getByTestId('platform-status-text')).toHaveTextContent('Ready');
      expect(screen.getByTestId('extension-status-text')).toHaveTextContent('Ready');
      // Server row shows radio button when extension path is complete
      expect(screen.getByTestId('connection-extension')).toBeInTheDocument();
    });

    test('should show platform compatibility status for unsupported platform', () => {
      const state = createUnsupportedPlatformState('firefox', 'macos');

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('platform-status-label')).toHaveTextContent('Platform Compatibility');
      expect(screen.getByTestId('platform-status-details')).toHaveTextContent('Firefox on macOS');

      // Should show Not Supported status for platform
      expect(screen.getByTestId('platform-status-text')).toHaveTextContent('Not Supported');
    });

    test('should show extension status for ready extension', () => {
      const state = createMockState({
        extension: createReadyExtensionState('2.1.0', 'ext-789'),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('extension-status-label')).toHaveTextContent('Browser Extension');
      expect(screen.getByTestId('extension-status-details')).toHaveTextContent('Version 2.1.0');

      // Should show Ready status for extension
      expect(screen.getByTestId('extension-status-text')).toHaveTextContent('Ready');
    });

    test('should show extension status for not installed extension', () => {
      const state = createExtensionNotInstalledState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('extension-status-label')).toHaveTextContent('Browser Extension');
      expect(screen.getByTestId('extension-status-details')).toHaveTextContent('Extension is not installed');

      // Should show Incomplete status for extension
      expect(screen.getByTestId('extension-status-text')).toHaveTextContent('Incomplete');
    });

    test('should show server status for ready server', () => {
      const state = createMockState({
        server: createReadyServerState('3.2.1'),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('server-status-label')).toHaveTextContent('Local Server');
      expect(screen.getByTestId('server-status-details')).toHaveTextContent('Version 3.2.1');

      // Server row shows radio button when extension path is complete
      expect(screen.getByTestId('connection-extension')).toBeInTheDocument();
    });

    test('should show server status for unreachable server', () => {
      const state = createServerNotReadyState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('server-status-label')).toHaveTextContent('Local Server');
      expect(screen.getByTestId('server-status-details')).toHaveTextContent('Server connection refused');

      // Server row shows "Not set up" hint when extension path is not complete
      expect(screen.getByTestId('connection-extension-hint')).toHaveTextContent('Not set up');
    });
  });

  describe('Continue Button Interaction', () => {
    test('should call sendMessage with modal:complete when continue button clicked', async () => {
      const user = userEvent.setup();
      const state = createAllSystemsReadyState();
      const sendMessageSpy = vi.fn().mockResolvedValue(undefined);

      useSetupModalStore.setState({ setupState: state, sendMessage: sendMessageSpy });
      render(<SuccessState />);

      const continueButton = screen.getByTestId('continue-button');
      await user.click(continueButton);

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:complete', undefined);
    });

    test('should not show continue button when setup is incomplete', () => {
      const state = createMockState({
        extension: createUnreachableExtensionState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.queryByText('Continue to Webpage')).not.toBeInTheDocument();
    });
  });

  describe('Help Text for Incomplete Setup', () => {
    test('should show navigation help text when setup is incomplete', () => {
      const state = createExtensionNotInstalledState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByText('You can navigate to any step using the progress indicator above to complete the remaining setup.')).toBeInTheDocument();
    });

    test('should not show navigation help text when all systems are ready', () => {
      const state = createAllSystemsReadyState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.queryByText('You can navigate to any step using the progress indicator above to complete the remaining setup.')).not.toBeInTheDocument();
    });
  });

  describe('Status Icon Display', () => {
    test('should show green checkmark icon when all systems ready', () => {
      const state = createAllSystemsReadyState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      // The component should have a green background when all ready
      const iconContainer = screen.getByText('All Systems Ready!').closest('div')?.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });

    test('should show amber clock icon when setup incomplete', () => {
      const state = createExtensionNotInstalledState();

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      // The component should have an amber background when incomplete
      const iconContainer = screen.getByText('Setup In Progress').closest('div')?.querySelector('.bg-amber-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Platform Name Display', () => {
    test('should handle unknown browser and OS gracefully', () => {
      const state = createMockState({
        env: { browser: 'unknown', os: 'unknown' },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByText('Unknown Browser on Unknown OS')).toBeInTheDocument();
    });

    test('should display actual platform names from setupState', () => {
      const state = createMockState({
        env: { browser: 'edge', os: 'windows' },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByText('Edge on Windows')).toBeInTheDocument();
    });
  });

  describe('LNA Server Status Row', () => {
    test('should show LNA server Ready status when LNA ready and lnaServer ready', () => {
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.5.0'),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('lna-server-status-label')).toHaveTextContent('Local Server (via LNA)');
      expect(screen.getByTestId('lna-server-status-details')).toHaveTextContent('Version 1.5.0');
      // LNA server row shows radio button when LNA path is complete
      expect(screen.getByTestId('connection-lna')).toBeInTheDocument();
    });

    test('should show LNA server Skipped status when LNA is skipped', () => {
      const state = createMockState({
        lna: createLnaSkippedState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('lna-server-status-label')).toHaveTextContent('Local Server (via LNA)');
      expect(screen.getByTestId('lna-server-status-details')).toHaveTextContent('Using browser extension instead');
      // LNA server row shows "Not set up" hint when LNA path is not complete
      expect(screen.getByTestId('connection-lna-hint')).toHaveTextContent('Not set up');
    });

    test('should show LNA server Skipped status when LNA is not-connected', () => {
      const state = createMockState({
        lna: createLnaPromptState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('lna-server-status-label')).toHaveTextContent('Local Server (via LNA)');
      expect(screen.getByTestId('lna-server-status-details')).toHaveTextContent('LNA not configured');
      // LNA server row shows "Not set up" hint when LNA path is not complete
      expect(screen.getByTestId('connection-lna-hint')).toHaveTextContent('Not set up');
    });

    test('should show grey text for LNA server label when LNA is skipped', () => {
      const state = createMockState({
        lna: createLnaSkippedState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      const label = screen.getByTestId('lna-server-status-label');
      expect(label).toHaveClass('text-gray-500');
    });
  });

  describe('Connection Selection', () => {
    test('should show LNA radio as selected when selectedConnection is lna and both paths ready', () => {
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.0.0'),
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: 'lna',
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      const lnaRadio = screen.getByTestId('connection-lna');
      const extRadio = screen.getByTestId('connection-extension');

      expect(lnaRadio).toHaveAttribute('aria-checked', 'true');
      expect(extRadio).toHaveAttribute('aria-checked', 'false');
    });

    test('should show Extension radio as selected when selectedConnection is extension and both paths ready', () => {
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.0.0'),
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: 'extension',
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      const lnaRadio = screen.getByTestId('connection-lna');
      const extRadio = screen.getByTestId('connection-extension');

      expect(lnaRadio).toHaveAttribute('aria-checked', 'false');
      expect(extRadio).toHaveAttribute('aria-checked', 'true');
    });

    test('should auto-select LNA when selectedConnection is null and LNA path is ready', () => {
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.0.0'),
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: null,
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      const lnaRadio = screen.getByTestId('connection-lna');
      const extRadio = screen.getByTestId('connection-extension');

      // LNA has priority when selectedConnection is null
      expect(lnaRadio).toHaveAttribute('aria-checked', 'true');
      expect(extRadio).toHaveAttribute('aria-checked', 'false');
    });

    test('should auto-select Extension when selectedConnection is null and only Extension path is ready', () => {
      const state = createMockState({
        lna: createLnaSkippedState(),
        lnaServer: { status: 'pending-lna-ready' },
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: null,
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      const lnaHint = screen.getByTestId('connection-lna-hint');
      const extRadio = screen.getByTestId('connection-extension');

      expect(lnaHint).toHaveTextContent('Not set up');
      expect(extRadio).toHaveAttribute('aria-checked', 'true');
    });

    test('should call sendMessage when LNA radio is clicked', async () => {
      const user = userEvent.setup();
      const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.0.0'),
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: 'extension',
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state, sendMessage: sendMessageSpy });
      render(<SuccessState />);

      const lnaRadio = screen.getByTestId('connection-lna');
      await user.click(lnaRadio);

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:select-connection', { connection: 'lna' });
    });

    test('should call sendMessage when Extension radio is clicked', async () => {
      const user = userEvent.setup();
      const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });
      const state = createMockState({
        lna: createLnaGrantedState('http://localhost:1135'),
        lnaServer: createLnaServerReadyState('1.0.0'),
        extension: createReadyExtensionState('1.0.0'),
        server: createReadyServerState('2.0.0'),
        selectedConnection: 'lna',
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state, sendMessage: sendMessageSpy });
      render(<SuccessState />);

      const extRadio = screen.getByTestId('connection-extension');
      await user.click(extRadio);

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:select-connection', { connection: 'extension' });
    });

    test('should show both hints when neither path is complete', () => {
      const state = createMockState({
        lna: createLnaSkippedState(),
        lnaServer: { status: 'pending-lna-ready' },
        extension: { status: 'not-installed', error: { message: 'Not installed', code: 'ext-not-installed' } },
        server: { status: 'pending-extension-ready', error: { message: 'Pending', code: 'server-pending-ext-ready' } },
        selectedConnection: null,
        userConfirmations: { serverInstall: true },
      });

      useSetupModalStore.setState({ setupState: state });
      render(<SuccessState />);

      expect(screen.getByTestId('connection-lna-hint')).toHaveTextContent('Not set up');
      expect(screen.getByTestId('connection-extension-hint')).toHaveTextContent('Not set up');
    });
  });
});
