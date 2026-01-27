import { ExtensionSetup } from '@/components/SetupWizard/Steps/ExtensionSetup';
import {
  createMockState,
  createNotInstalledExtensionState,
  createReadyExtensionState,
  createUnreachableExtensionState,
  createUnsupportedExtensionState,
  createReadyServerState,
  createUnreachableServerState,
  createSetupServerState,
  createResourceAdminServerState,
} from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { beforeEach } from 'vitest';

describe('ExtensionSetup - Accordion Initial State Combinations', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        extensionStep: {
          browserOverride: null,
          extensionAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  const accordionStateCases = [
    {
      name: 'extension NOT ready + server ready → extension open, server closed',
      extension: createNotInstalledExtensionState(),
      server: createReadyServerState(),
      extensionOpen: true,
      serverOpen: false,
    },
    {
      name: 'extension NOT ready + server NOT ready → extension open (priority), server closed',
      extension: createNotInstalledExtensionState(),
      server: createUnreachableServerState(),
      extensionOpen: true,
      serverOpen: false,
    },
    {
      name: 'extension ready + server NOT ready → extension closed, server open',
      extension: createReadyExtensionState(),
      server: createUnreachableServerState(),
      extensionOpen: false,
      serverOpen: true,
    },
    {
      name: 'extension ready + server ready → both closed',
      extension: createReadyExtensionState(),
      server: createReadyServerState(),
      extensionOpen: false,
      serverOpen: false,
    },
  ];

  test.each(accordionStateCases)('should have $name', ({ extension, server, extensionOpen, serverOpen }) => {
    const state = createMockState({ extension, server });
    useSetupModalStore.setState({ setupState: state });
    render(<ExtensionSetup />);

    const extensionContent = screen.queryByTestId('extension-accordion-content');
    const serverContent = screen.queryByTestId('server-accordion-content');

    expect(!!extensionContent).toBe(extensionOpen);
    expect(!!serverContent).toBe(serverOpen);
  });
});

describe('ExtensionSetup - Accordion UI', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        extensionStep: {
          browserOverride: null,
          extensionAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  describe('Accordion Structure', () => {
    test('should render extension accordion header', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('extension-accordion-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Extension Installation');
    });

    test('should render server accordion header', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('server-accordion-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Server Status');
    });

    test('should show extension accordion open by default when extension not ready', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createReadyServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByTestId('extension-accordion-content')).toBeInTheDocument();
    });

    test('should show server accordion open by default when extension ready but server has issues', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByTestId('server-accordion-content')).toBeInTheDocument();
    });

    test('should toggle extension accordion on click', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByTestId('extension-accordion-content')).toBeInTheDocument();

      await user.click(screen.getByTestId('extension-accordion-header'));
      expect(screen.queryByTestId('extension-accordion-content')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('extension-accordion-header'));
      expect(screen.getByTestId('extension-accordion-content')).toBeInTheDocument();
    });

    test('should toggle server accordion on click', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByTestId('server-accordion-content')).toBeInTheDocument();

      await user.click(screen.getByTestId('server-accordion-header'));
      expect(screen.queryByTestId('server-accordion-content')).not.toBeInTheDocument();
    });
  });

  describe('Extension Status Labels', () => {
    test('should show Ready status when extension is ready', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('extension-accordion-header');
      expect(header).toHaveTextContent('Ready');
    });

    test('should show Action Required status when extension not ready', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('extension-accordion-header');
      expect(header).toHaveTextContent('Action Required');
    });
  });

  describe('Server Status Labels', () => {
    test('should show Connected status when server is ready', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createReadyServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('server-accordion-header');
      expect(header).toHaveTextContent('Connected');
    });

    test('should show Pending Extension status when extension not ready', () => {
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('server-accordion-header');
      expect(header).toHaveTextContent('Pending Extension');
    });

    test('should show Action Required status when extension ready but server has issues', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const header = screen.getByTestId('server-accordion-header');
      expect(header).toHaveTextContent('Action Required');
    });
  });

  describe('Server Content States', () => {
    test('should show pending message when extension not ready', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createNotInstalledExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      await user.click(screen.getByTestId('server-accordion-header'));

      expect(screen.getByText('Server connection will be verified once extension is installed.')).toBeInTheDocument();
    });

    test('should show server version when connected', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createReadyServerState('2.5.0'),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      await user.click(screen.getByTestId('server-accordion-header'));

      expect(screen.getByText(/Server v2.5.0 connected successfully/)).toBeInTheDocument();
    });

    test('should show troubleshooting for unreachable server', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText(/Make sure the Bodhi App Server is running/)).toBeInTheDocument();
    });

    test('should show setup link for server in setup state', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createSetupServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText('Server needs initial configuration.')).toBeInTheDocument();
      expect(screen.getByText('Open Server Setup →')).toBeInTheDocument();
    });

    test('should show admin link for server in resource-admin state', () => {
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createResourceAdminServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText('Server requires admin approval.')).toBeInTheDocument();
      expect(screen.getByText('Open Admin Panel →')).toBeInTheDocument();
    });
  });

  describe('Extension Content - Dropdown Pre-selection', () => {
    const initialSelectionCases = [
      {
        name: 'pre-selects Chrome when env.browser is chrome',
        state: createMockState({
          env: { browser: 'chrome', os: 'macos' },
          extension: createNotInstalledExtensionState(),
        }),
        expectedSelection: 'Chrome',
      },
      {
        name: 'pre-selects Edge when env.browser is edge',
        state: createMockState({
          env: { browser: 'edge', os: 'windows' },
          extension: createNotInstalledExtensionState(),
        }),
        expectedSelection: 'Edge',
      },
      {
        name: 'pre-selects Firefox when env.browser is firefox (unsupported)',
        state: createMockState({
          env: { browser: 'firefox', os: 'macos' },
          extension: createNotInstalledExtensionState(),
        }),
        expectedSelection: 'Firefox',
      },
    ];

    test.each(initialSelectionCases)('should $name', ({ state, expectedSelection }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      const dropdownButton = screen.getByText(expectedSelection).closest('button')!;
      expect(dropdownButton).toHaveTextContent(expectedSelection);

      const autoSelectedText = screen.getByText(/Auto-selected:/);
      expect(autoSelectedText).toHaveTextContent(expectedSelection);
    });
  });

  describe('Extension Content - Status Display', () => {
    test('should show success status for ready extension', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createReadyExtensionState('2.0.1'),
        server: createUnreachableServerState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      await user.click(screen.getByTestId('extension-accordion-header'));

      expect(screen.getByText('Extension version 2.0.1 is connected and ready.')).toBeInTheDocument();
    });

    const extensionErrorStatusCases = [
      {
        name: 'shows error status for not-installed extension',
        extension: createNotInstalledExtensionState('Extension is not installed'),
        expectedMessage: 'Extension is not installed',
      },
      {
        name: 'shows error status for unreachable extension',
        extension: createUnreachableExtensionState('Could not connect to extension'),
        expectedMessage: 'Could not connect to extension',
      },
      {
        name: 'shows warning status for unsupported extension',
        extension: createUnsupportedExtensionState('Extension version not supported'),
        expectedMessage: 'Extension version not supported',
      },
    ];

    test.each(extensionErrorStatusCases)('should $name', ({ extension, expectedMessage }) => {
      const state = createMockState({ extension });
      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    });
  });

  describe('Extension Content - Dropdown State Reset', () => {
    test('should reset dropdown selection when env.browser changes', () => {
      const initialState = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        extension: createNotInstalledExtensionState(),
      });

      useSetupModalStore.setState({ setupState: initialState });
      const { rerender } = render(<ExtensionSetup />);

      const dropdownButton = screen.getByText('Chrome').closest('button')!;
      expect(dropdownButton).toHaveTextContent('Chrome');

      const newState = createMockState({
        env: { browser: 'firefox', os: 'macos' },
        extension: createNotInstalledExtensionState(),
      });

      useSetupModalStore.setState({ setupState: newState });
      rerender(<ExtensionSetup />);

      const updatedDropdownButton = screen.getByText('Firefox').closest('button')!;
      expect(updatedDropdownButton).toHaveTextContent('Firefox');
    });
  });

  describe('Extension Content - Temporary Override Behavior', () => {
    test('should allow temporary browser override', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        extension: createNotInstalledExtensionState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      let dropdownButton = screen.getByText('Chrome').closest('button')!;
      await user.click(dropdownButton);
      await user.click(screen.getByText('Firefox'));

      dropdownButton = screen.getByText('Firefox').closest('button')!;
      expect(dropdownButton).toHaveTextContent('Firefox');
      expect(screen.getByText(/Auto-selected: Chrome/)).toBeInTheDocument();
    });
  });

  describe('Extension Content - Store Links', () => {
    test('should show correct extension store link for supported browsers', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        env: { browser: 'chrome', os: 'macos' },
        extension: createNotInstalledExtensionState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText('Copy Extension URL for Chrome')).toBeInTheDocument();

      const dropdownButton = screen.getByText('Chrome').closest('button')!;
      await user.click(dropdownButton);
      await user.click(screen.getByText('Edge'));

      expect(screen.getByText('Copy Extension URL for Edge')).toBeInTheDocument();
    });

    test('should show GitHub issue link for unsupported browsers', () => {
      const state = createMockState({
        env: { browser: 'firefox', os: 'macos' },
        extension: createNotInstalledExtensionState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText('Track Progress')).toBeInTheDocument();
    });
  });

  describe('Extension Content - Troubleshooting', () => {
    test('should show troubleshooting when extension is not ready', () => {
      const state = createMockState({
        extension: createUnreachableExtensionState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      expect(screen.getByText("Make sure you're using a supported browser version")).toBeInTheDocument();
    });

    test('should not show troubleshooting when extension is ready', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        extension: createReadyExtensionState(),
        server: createReadyServerState(),
      });

      useSetupModalStore.setState({ setupState: state });
      render(<ExtensionSetup />);

      await user.click(screen.getByTestId('extension-accordion-header'));

      expect(screen.queryByText("Make sure you're using a supported browser version")).not.toBeInTheDocument();
    });
  });
});
