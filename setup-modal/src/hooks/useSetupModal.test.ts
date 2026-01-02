import { useSetupModal } from '@/hooks/useSetupModal';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { MessageBuilder } from '@/lib/protocol';
import { createMockState } from '@/test/mock-factories';
import { act, renderHook, waitFor } from '@testing-library/react';

// Mock postMessage
const mockPostMessage = vi.fn();
Object.defineProperty(window, 'parent', {
  value: { postMessage: mockPostMessage },
  writable: true,
});

describe('useSetupModal', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
    // Reset store state before each test
    useSetupModalStore.setState({
      setupState: undefined,
      channel: null,
      ui: {
        currentStep: 'platform-check' as any,
        isRefreshing: false,
        extensionStep: {
          browserOverride: null,
          extensionAccordionOpen: false,
          serverAccordionOpen: false,
        },
        lnaStep: {
          serverUrl: '',
          lnaAccordionOpen: false,
          serverAccordionOpen: false,
        },
        serverStep: {
          osOverride: null,
        },
      },
    });
  });

  test('should initialize with null setupState', () => {
    const { result } = renderHook(() => useSetupModal());

    expect(result.current.setupState).toBeUndefined();
    expect(typeof result.current.sendMessage).toBe('function');
  });

  test('should send ready request message on mount', () => {
    renderHook(() => useSetupModal());

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
    const { result } = renderHook(() => useSetupModal());
    const mockState = createMockState();

    // Get the request message that was sent
    const [[readyRequest]] = mockPostMessage.mock.calls;

    // Simulate parent responding with state
    const responseMessage = MessageBuilder.response('modal:ready', readyRequest.requestId, {
      setupState: mockState,
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: responseMessage,
          origin: 'http://localhost',
        })
      );
    });

    // Wait for state update
    await waitFor(() => {
      expect(result.current.setupState).toEqual(mockState);
    });
  });

  test('should update setupState when receiving state-update event', async () => {
    const { result } = renderHook(() => useSetupModal());
    const mockState = createMockState();

    const eventMessage = MessageBuilder.event('parent:state-update', { setupState: mockState });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: eventMessage,
          origin: 'http://localhost',
        })
      );
    });

    // Wait for state update
    await waitFor(() => {
      expect(result.current.setupState).toEqual(mockState);
    });
  });

  test('should ignore non-protocol messages', () => {
    const { result } = renderHook(() => useSetupModal());

    act(() => {
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'other:message',
          data: createMockState(),
        },
        origin: 'http://localhost',
      });
      window.dispatchEvent(messageEvent);
    });

    expect(result.current.setupState).toBeUndefined();
  });

  test('should send messages via sendMessage', async () => {
    const { result } = renderHook(() => useSetupModal());
    mockPostMessage.mockClear(); // Clear the ready message

    await act(async () => {
      // Send a message (don't await the promise as we're not testing the response)
      void result.current.sendMessage('modal:refresh', undefined);
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request',
        type: 'modal:refresh',
        requestId: expect.any(String),
        payload: undefined,
      }),
      expect.any(String) // origin will be validated from first message
    );
  });
});
