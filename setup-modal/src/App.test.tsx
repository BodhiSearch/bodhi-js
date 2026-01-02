import { App } from '@/App';
import { render, screen, waitFor } from '@/test/test-utils';
import { createMockState } from '@/test/mock-factories';
import { MessageBuilder } from '@/lib/protocol';

// Mock window.parent.postMessage
const mockPostMessage = vi.fn();
Object.defineProperty(window, 'parent', {
  writable: true,
  value: {
    postMessage: mockPostMessage,
  },
});

describe('App - Integration', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  test('should render SetupWizard', () => {
    render(<App />);

    // Should show platform check with DEFAULT_SETUP_STATE (unknown platform)
    expect(screen.getByText('Platform Compatibility Check')).toBeInTheDocument();
  });

  test('should send modal:ready request message on mount', () => {
    render(<App />);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request',
        type: 'modal:ready',
        requestId: expect.any(String),
        payload: undefined,
      }),
      '*'
    );
  });

  test('should update setupState when receiving response to ready', async () => {
    render(<App />);

    // Get the ready request that was sent
    const [[readyRequest]] = mockPostMessage.mock.calls;
    const mockState = createMockState();

    // Simulate parent responding with state
    const responseMessage = MessageBuilder.response('modal:ready', readyRequest.requestId, {
      setupState: mockState,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: responseMessage,
        origin: 'http://localhost',
      })
    );

    // Wait for state to be processed and wizard to render
    await waitFor(() => {
      expect(screen.queryByText('Loading setup data...')).not.toBeInTheDocument();
    });

    // SetupWizard should render with wizard controls
    expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    expect(screen.getByTestId('close-button')).toBeInTheDocument();
  });

  test('should update setupState when receiving state-update event', async () => {
    render(<App />);

    const mockState = createMockState();
    const eventMessage = MessageBuilder.event('parent:state-update', { setupState: mockState });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: eventMessage,
        origin: 'http://localhost',
      })
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading setup data...')).not.toBeInTheDocument();
    });

    // Should render wizard controls
    expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    expect(screen.getByTestId('close-button')).toBeInTheDocument();
  });
});
