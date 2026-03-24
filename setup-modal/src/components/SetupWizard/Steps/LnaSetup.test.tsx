import { LnaSetup } from '@/components/SetupWizard/Steps/LnaSetup';
import {
  createMockState,
  createLnaPromptState,
  createLnaSkippedState,
  createLnaGrantedState,
  createLnaUnreachableState,
  createLnaDeniedState,
  createLnaServerPendingState,
  createLnaServerReadyState,
  createLnaServerSetupState,
  createLnaServerResourceAdminState,
  createLnaServerErrorState,
} from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import { useSetupModalStore } from '@/store/setup-modal-store';

describe('LnaSetup - Accordion Initial State Combinations', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });
  const accordionStateCases = [
    {
      name: 'lna NOT ready (prompt) → lna open, server closed',
      lna: createLnaPromptState(),
      lnaServer: createLnaServerPendingState(),
      lnaOpen: true,
      serverOpen: false,
    },
    {
      name: 'lna NOT ready (skipped) → lna open, server closed',
      lna: createLnaSkippedState(),
      lnaServer: createLnaServerPendingState(),
      lnaOpen: true,
      serverOpen: false,
    },
    {
      name: 'lna NOT ready (unreachable) → lna open, server closed',
      lna: createLnaUnreachableState(),
      lnaServer: createLnaServerPendingState(),
      lnaOpen: true,
      serverOpen: false,
    },
    {
      name: 'lna NOT ready (denied) → lna open, server closed',
      lna: createLnaDeniedState(),
      lnaServer: createLnaServerPendingState(),
      lnaOpen: true,
      serverOpen: false,
    },
    {
      name: 'lna granted + server NOT ready → lna closed, server open',
      lna: createLnaGrantedState(),
      lnaServer: createLnaServerSetupState(),
      lnaOpen: false,
      serverOpen: true,
    },
    {
      name: 'lna granted + server ready → both closed',
      lna: createLnaGrantedState(),
      lnaServer: createLnaServerReadyState(),
      lnaOpen: false,
      serverOpen: false,
    },
  ];

  test.each(accordionStateCases)('should have $name', ({ lna, lnaServer, lnaOpen, serverOpen }) => {
    const state = createMockState({ lna, lnaServer });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    const lnaContent = screen.queryByTestId('lna-accordion-content');
    const serverContent = screen.queryByTestId('lna-server-status');

    expect(!!lnaContent).toBe(lnaOpen);
    expect(!!serverContent).toBe(serverOpen);
  });
});

describe('LnaSetup - Accordion UI', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  describe('Accordion Structure', () => {
    test('should render lna accordion header', () => {
      const state = createMockState({
        lna: createLnaPromptState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      const header = screen.getByTestId('lna-accordion-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('LNA Connection');
    });

    test('should render server accordion header', () => {
      const state = createMockState({
        lna: createLnaPromptState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      const header = screen.getByTestId('lna-server-accordion-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Server Status');
    });

    test('should toggle lna accordion on click', async () => {
      const user = userEvent.setup();
      const state = createMockState({
        lna: createLnaPromptState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      expect(screen.getByTestId('lna-accordion-content')).toBeInTheDocument();

      await user.click(screen.getByTestId('lna-accordion-header'));
      expect(screen.queryByTestId('lna-accordion-content')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('lna-accordion-header'));
      expect(screen.getByTestId('lna-accordion-content')).toBeInTheDocument();
    });

    test('should toggle server accordion on click', async () => {
      const user = userEvent.setup();

      const state = createMockState({
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerSetupState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      expect(screen.getByTestId('lna-server-status')).toBeInTheDocument();

      await user.click(screen.getByTestId('lna-server-accordion-header'));
      expect(screen.queryByTestId('lna-server-status')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('lna-server-accordion-header'));
      expect(screen.getByTestId('lna-server-status')).toBeInTheDocument();
    });
  });

  describe('LNA Status Labels', () => {
    const lnaStatusLabelCases = [
      {
        name: 'Connected when lna is granted',
        lna: createLnaGrantedState(),
        expectedLabel: 'Connected',
      },
      {
        name: 'Skipped when lna is skipped',
        lna: createLnaSkippedState(),
        expectedLabel: 'Skipped',
      },
      {
        name: 'Connection Failed when lna is unreachable',
        lna: createLnaUnreachableState(),
        expectedLabel: 'Connection Failed',
      },
      {
        name: 'Permission Denied when lna is denied',
        lna: createLnaDeniedState(),
        expectedLabel: 'Permission Denied',
      },
      {
        name: 'Not Connected when lna is prompt',
        lna: createLnaPromptState(),
        expectedLabel: 'Not Connected',
      },
    ];

    test.each(lnaStatusLabelCases)('should show $name', ({ lna, expectedLabel }) => {
      const state = createMockState({ lna });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      const header = screen.getByTestId('lna-accordion-header');
      expect(header).toHaveTextContent(expectedLabel);
    });
  });

  describe('Server Status Labels', () => {
    const serverStatusLabelCases = [
      {
        name: 'Pending LNA when lna is not granted',
        lna: createLnaPromptState(),
        lnaServer: createLnaServerPendingState(),
        expectedLabel: 'Pending LNA',
      },
      {
        name: 'Connected when server is ready',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerReadyState(),
        expectedLabel: 'Connected',
      },
      {
        name: 'Setup Required when server is setup',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerSetupState(),
        expectedLabel: 'Setup Required',
      },
      {
        name: 'Admin Required when server is resource-admin',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerResourceAdminState(),
        expectedLabel: 'Admin Required',
      },
      {
        name: 'Error when server has error',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerErrorState(),
        expectedLabel: 'Error',
      },
      {
        name: 'Checking... when server is pending-lna-ready with lna granted',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerPendingState(),
        expectedLabel: 'Checking...',
      },
    ];

    test.each(serverStatusLabelCases)('should show $name', ({ lna, lnaServer, expectedLabel }) => {
      const state = createMockState({ lna, lnaServer });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      const header = screen.getByTestId('lna-server-accordion-header');
      expect(header).toHaveTextContent(expectedLabel);
    });
  });
});

describe('LnaSetup - URL Input', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  test('should have default URL value', () => {
    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    const input = screen.getByTestId('lna-url-input');
    expect(input).toHaveValue('http://localhost:1135');
  });

  test('should initialize URL from lna.serverUrl when ready', async () => {
    const user = userEvent.setup();

    const state = createMockState({
      lna: createLnaGrantedState('http://custom:8080'),
      lnaServer: createLnaServerReadyState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // Open accordion first (closed by default when lna is ready)
    await user.click(screen.getByTestId('lna-accordion-header'));

    const input = screen.getByTestId('lna-url-input');
    expect(input).toHaveValue('http://custom:8080');
  });

  test('should initialize URL from lna.serverUrl when unreachable', () => {
    const state = createMockState({
      lna: createLnaUnreachableState('http://failed:9000'),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    const input = screen.getByTestId('lna-url-input');
    expect(input).toHaveValue('http://failed:9000');
  });

  test('should update URL on input change', async () => {
    const user = userEvent.setup();

    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    const input = screen.getByTestId('lna-url-input');
    // Directly type new value (input is controlled by store state)
    await user.type(input, 'http://newurl:3000');

    expect(input).toHaveValue('http://localhost:1135http://newurl:3000');
  });
});

describe('LnaSetup - Connect Button', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  describe('Button Labels', () => {
    const buttonLabelCases = [
      {
        name: 'Connect for not-connected',
        lna: createLnaPromptState(),
        expectedLabel: 'Connect',
      },
      {
        name: 'Reconnect for ready',
        lna: createLnaGrantedState(),
        lnaServer: createLnaServerReadyState(),
        expectedLabel: 'Reconnect',
      },
      {
        name: 'Try Again for unreachable',
        lna: createLnaUnreachableState(),
        expectedLabel: 'Try Again',
      },
      {
        name: 'Try Again for permission-denied',
        lna: createLnaDeniedState(),
        expectedLabel: 'Try Again',
      },
      {
        name: 'Connect for skipped',
        lna: createLnaSkippedState(),
        expectedLabel: 'Connect',
      },
    ];

    test.each(buttonLabelCases)('should show $name', async ({ lna, lnaServer, expectedLabel }) => {
      const user = userEvent.setup();

      const state = createMockState({
        lna,
        lnaServer: lnaServer || createLnaServerPendingState(),
      });
      useSetupModalStore.setState({ setupState: state });
      render(<LnaSetup />);

      // Open accordion if needed
      if (!screen.queryByTestId('lna-accordion-content')) {
        await user.click(screen.getByTestId('lna-accordion-header'));
      }

      const button = screen.getByTestId('lna-connect-button');
      expect(button).toHaveTextContent(expectedLabel);
    });
  });

  test('should send modal:lna:connect with serverUrl on click', async () => {
    const user = userEvent.setup();
    const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });

    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({
      setupState: state,
      sendMessage: sendMessageSpy,
    });
    render(<LnaSetup />);

    // Set URL directly in store to avoid useEffect re-initialization
    useSetupModalStore.getState().setServerUrl('http://test:5000');

    const button = screen.getByTestId('lna-connect-button');
    await user.click(button);

    expect(sendMessageSpy).toHaveBeenCalledWith('modal:lna:connect', {
      serverUrl: 'http://test:5000',
    });
  });

  test('should send default URL when not modified', async () => {
    const user = userEvent.setup();
    const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });

    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({
      setupState: state,
      sendMessage: sendMessageSpy,
    });
    render(<LnaSetup />);

    const button = screen.getByTestId('lna-connect-button');
    await user.click(button);

    expect(sendMessageSpy).toHaveBeenCalledWith('modal:lna:connect', {
      serverUrl: 'http://localhost:1135',
    });
  });
});

describe('LnaSetup - Skip Button', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  test('should show skip button when lna is not skipped', () => {
    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByTestId('lna-skip-button')).toBeInTheDocument();
  });

  test('should NOT show skip button when lna is skipped', () => {
    const state = createMockState({
      lna: createLnaSkippedState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // Accordion should be open by default since skipped != ready
    expect(screen.queryByTestId('lna-skip-button')).not.toBeInTheDocument();
  });

  test('should send modal:lna:skip on click', async () => {
    const user = userEvent.setup();
    const sendMessageSpy = vi.fn().mockResolvedValue({ success: true });

    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({
      setupState: state,
      sendMessage: sendMessageSpy,
    });
    render(<LnaSetup />);

    const button = screen.getByTestId('lna-skip-button');
    await user.click(button);

    expect(sendMessageSpy).toHaveBeenCalledWith('modal:lna:skip', undefined);
  });

  test('should show skip button for error states', () => {
    const state = createMockState({
      lna: createLnaUnreachableState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByTestId('lna-skip-button')).toBeInTheDocument();
  });
});

describe('LnaSetup - LNA Content States', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  test('should show success message when lna is ready', async () => {
    const user = userEvent.setup();

    const state = createMockState({
      lna: createLnaGrantedState('http://localhost:1135'),
      lnaServer: createLnaServerReadyState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    await user.click(screen.getByTestId('lna-accordion-header'));

    expect(screen.getByText(/Direct connection established to/)).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/localhost:1135/)).toBeInTheDocument();
  });

  test('should show configure message when lna is not-connected', () => {
    const state = createMockState({
      lna: createLnaPromptState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByText(/Configure direct connection to your local Bodhi server/)).toBeInTheDocument();
  });

  test('should show error message when lna is unreachable', () => {
    const state = createMockState({
      lna: createLnaUnreachableState('http://localhost:1135', 'Could not connect to server'),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // "Connection Failed" appears in both header label and content title
    const connectionFailedElements = screen.getAllByText('Connection Failed');
    expect(connectionFailedElements.length).toBe(2);
    expect(screen.getByText('Could not connect to server')).toBeInTheDocument();
  });

  test('should show permission denied message when lna is permission-denied', () => {
    const state = createMockState({
      lna: createLnaDeniedState('Local network access permission denied'),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // "Permission Denied" appears in both header label and content title
    const permissionDeniedElements = screen.getAllByText('Permission Denied');
    expect(permissionDeniedElements.length).toBe(2);
    expect(screen.getByText('Local network access permission denied')).toBeInTheDocument();
  });

  test('should show skipped message when lna is skipped', () => {
    const state = createMockState({
      lna: createLnaSkippedState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByText(/Direct connection skipped/)).toBeInTheDocument();
  });
});

describe('LnaSetup - Server Content States', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
      ui: {
        ...useSetupModalStore.getState().ui,
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
      },
    });
  });

  test('should show pending message when lna is not ready', async () => {
    const user = userEvent.setup();

    const state = createMockState({
      lna: createLnaPromptState(),
      lnaServer: createLnaServerPendingState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    await user.click(screen.getByTestId('lna-server-accordion-header'));

    expect(screen.getByText(/Server status will be checked once LNA connection is established/)).toBeInTheDocument();
  });

  test('should show checking message when server is pending-lna-ready with lna ready', () => {
    const state = createMockState({
      lna: createLnaGrantedState(),
      lnaServer: createLnaServerPendingState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // Server accordion auto-opens since lna=ready but server has issues
    expect(screen.getByText('Checking server...')).toBeInTheDocument();
  });

  test('should show server version when connected', async () => {
    const user = userEvent.setup();

    const state = createMockState({
      lna: createLnaGrantedState(),
      lnaServer: createLnaServerReadyState('2.5.0'),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    // Open server accordion (both closed when both ready)
    await user.click(screen.getByTestId('lna-server-accordion-header'));

    expect(screen.getByText(/Server v2.5.0 connected successfully/)).toBeInTheDocument();
  });

  test('should show setup link for server in setup state', () => {
    const state = createMockState({
      lna: createLnaGrantedState('http://localhost:1135'),
      lnaServer: createLnaServerSetupState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByText(/Server requires initial setup/)).toBeInTheDocument();
    const link = screen.getByTestId('lna-server-setup-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'http://localhost:1135/setup');
  });

  test('should show admin link for server in resource-admin state', () => {
    const state = createMockState({
      lna: createLnaGrantedState('http://localhost:1135'),
      lnaServer: createLnaServerResourceAdminState(),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByText(/Server requires resource configuration/)).toBeInTheDocument();
    const link = screen.getByTestId('lna-server-admin-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'http://localhost:1135/admin');
  });

  test('should show error message and troubleshooting for server error', () => {
    const state = createMockState({
      lna: createLnaGrantedState(),
      lnaServer: createLnaServerErrorState('Connection timed out'),
    });
    useSetupModalStore.setState({ setupState: state });
    render(<LnaSetup />);

    expect(screen.getByText('Server connection error')).toBeInTheDocument();
    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getByText(/Make sure the Bodhi App Server is running/)).toBeInTheDocument();
  });
});
