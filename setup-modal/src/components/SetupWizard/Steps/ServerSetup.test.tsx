import { ServerSetup } from '@/components/SetupWizard/Steps/ServerSetup';
import { createMockState, createUnreachableServerState } from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, beforeEach, vi } from 'vitest';
import { useSetupModalStore } from '@/store/setup-modal-store';

describe('ServerSetup - Confirmation Mode', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        serverStep: {
          osOverride: null,
        },
      },
    });
  });

  describe('Initial OS Dropdown Selection', () => {
    const initialOSSelectionCases = [
      {
        name: 'pre-selects macOS when env.os is macos',
        state: createMockState({
          env: { browser: 'chrome', os: 'macos' },
          server: createUnreachableServerState(),
        }),
        expectedSelection: 'macOS',
      },
      {
        name: 'pre-selects Windows when env.os is windows',
        state: createMockState({
          env: { browser: 'chrome', os: 'windows' },
          server: createUnreachableServerState(),
        }),
        expectedSelection: 'Windows',
      },
      {
        name: 'pre-selects Linux when env.os is linux (unsupported)',
        state: createMockState({
          env: { browser: 'chrome', os: 'linux' },
          server: createUnreachableServerState(),
        }),
        expectedSelection: 'Linux',
      },
      {
        name: 'pre-selects Unknown OS when env.os is unknown',
        state: createMockState({
          env: { browser: 'chrome', os: 'unknown' },
          server: createUnreachableServerState(),
        }),
        expectedSelection: 'Unknown OS',
      },
    ];

    test.each(initialOSSelectionCases)('should $name', ({ state, expectedSelection }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      const dropdownContainer = screen.getByText(/Select Operating System \(for server download\)/);
      expect(dropdownContainer).toBeInTheDocument();

      const dropdownButton = screen.getByText(expectedSelection).closest('button')!;
      expect(dropdownButton).toHaveTextContent(expectedSelection);

      const autoSelectedText = screen.getByText(/Auto-selected:/);
      expect(autoSelectedText).toHaveTextContent(expectedSelection);
    });
  });

  describe('Dropdown State Reset on env.os Change', () => {
    test('should reset OS dropdown selection when env.os changes', () => {
      const initialState = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        server: createUnreachableServerState(),
      });

      useSetupModalStore.setState({ setupState: initialState });
      const { rerender } = render(<ServerSetup />);

      let dropdownButton = screen.getByText('macOS').closest('button')!;
      expect(dropdownButton).toHaveTextContent('macOS');

      const newState = createMockState({
        env: { browser: 'chrome', os: 'windows' },
        server: createUnreachableServerState(),
      });

      useSetupModalStore.setState({ setupState: newState });
      rerender(<ServerSetup />);

      dropdownButton = screen.getByText('Windows').closest('button')!;
      expect(dropdownButton).toHaveTextContent('Windows');
      expect(screen.getByText(/Auto-selected: Windows/)).toBeInTheDocument();
    });
  });

  describe('Temporary OS Override Behavior', () => {
    test('should allow temporary OS override while staying on same step', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        server: createUnreachableServerState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      let dropdownButton = screen.getByText('macOS').closest('button')!;
      expect(dropdownButton).toHaveTextContent('macOS');

      await user.click(dropdownButton);
      const windowsOption = screen.getByText('Windows');
      await user.click(windowsOption);

      dropdownButton = screen.getByText('Windows').closest('button')!;
      expect(dropdownButton).toHaveTextContent('Windows');
      expect(screen.getByText(/Auto-selected: macOS/)).toBeInTheDocument();
    });
  });

  describe('Server Download Links', () => {
    test('should show correct download link for supported OS', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        server: createUnreachableServerState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      const downloadButton = screen.getByText('Download Bodhi App Server for macOS');
      expect(downloadButton).toBeInTheDocument();

      const dropdownButton = screen.getByText('macOS').closest('button')!;
      await user.click(dropdownButton);
      await user.click(screen.getByText('Windows'));

      expect(screen.getByText('Download Bodhi App Server for Windows')).toBeInTheDocument();
    });

    test('should show GitHub issue link for unsupported OS', () => {
      const state = createMockState({
        env: { browser: 'chrome', os: 'linux' },
        server: createUnreachableServerState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      expect(screen.getByText('Track Progress')).toBeInTheDocument();
    });
  });

  describe('Confirmation Checkbox', () => {
    test('should render unchecked when serverInstall is false', () => {
      const state = createMockState({ userConfirmations: { serverInstall: false } });
      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      const checkbox = screen.getByTestId('server-confirm-checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('should render checked when serverInstall is true', () => {
      const state = createMockState({ userConfirmations: { serverInstall: true } });
      useSetupModalStore.setState({ setupState: state });
      render(<ServerSetup />);

      const checkbox = screen.getByTestId('server-confirm-checkbox');
      expect(checkbox).toBeChecked();
    });

    test('should call sendMessage with confirmed:true when checked', async () => {
      const user = userEvent.setup();
      const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });
      const state = createMockState({ userConfirmations: { serverInstall: false } });
      useSetupModalStore.setState({
        setupState: state,
        sendMessage: sendMessageSpy,
      });
      render(<ServerSetup />);

      await user.click(screen.getByTestId('server-confirm-checkbox'));

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:confirm-server-install', { confirmed: true });
    });

    test('should call sendMessage with confirmed:false when unchecked', async () => {
      const user = userEvent.setup();
      const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });
      const state = createMockState({ userConfirmations: { serverInstall: true } });
      useSetupModalStore.setState({
        setupState: state,
        sendMessage: sendMessageSpy,
      });
      render(<ServerSetup />);

      await user.click(screen.getByTestId('server-confirm-checkbox'));

      expect(sendMessageSpy).toHaveBeenCalledWith('modal:confirm-server-install', { confirmed: false });
    });
  });
});
