/**
 * Unit tests for MessageChannel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageChannel } from './message-channel';
import { MessageBuilder } from './message-builder';
import { createMockState } from '@/test/mock-factories';

describe('MessageChannel', () => {
  let mockWindow: Window;
  let channel: MessageChannel;

  beforeEach(() => {
    mockWindow = {
      postMessage: vi.fn(),
    } as any;

    // Mock setTimeout and clearTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    channel?.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      channel = new MessageChannel(mockWindow);
      expect(channel).toBeDefined();
      expect(channel.getValidatedOrigin()).toBeNull();
    });

    it('should initialize with custom options', () => {
      channel = new MessageChannel(mockWindow, {
        timeout: 10000,
        expectedOrigin: 'http://example.com',
        debug: true,
      });
      expect(channel).toBeDefined();
      expect(channel.getValidatedOrigin()).toBe('http://example.com');
    });

    it('should add message event listener', () => {
      const spy = vi.spyOn(window, 'addEventListener');
      channel = new MessageChannel(mockWindow);
      expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('request()', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow, { debug: false });
    });

    it('should send request message', async () => {
      void channel.request('modal:ready', undefined).catch(() => {
        // Expected - channel will be disposed
      });

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'request',
          type: 'modal:ready',
          requestId: expect.any(String),
          payload: undefined,
        }),
        '*'
      );

      // Cancel pending request
      channel.dispose();
    });

    it('should resolve on response', async () => {
      const setupState = createMockState();
      const promise = channel.request('modal:ready', undefined);

      // Get the sent message
      const [[message]] = (mockWindow.postMessage as any).mock.calls;

      // Simulate response
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.response('modal:ready', message.requestId, { setupState }),
          origin: 'http://localhost',
        })
      );

      const result = await promise;
      expect(result.setupState).toEqual(setupState);
    });

    it('should reject on timeout', async () => {
      const promise = channel.request('modal:ready', undefined);

      // Advance time past timeout
      vi.advanceTimersByTime(1100);

      await expect(promise).rejects.toThrow('Request timeout after 1000ms: modal:ready');
    });

    it('should reject on error response', async () => {
      const promise = channel.request('modal:lna:connect', { serverUrl: 'invalid' });

      // Get the sent message
      const [[message]] = (mockWindow.postMessage as any).mock.calls;

      // Simulate error response
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.error(message.requestId, {
            code: 'INVALID_URL',
            message: 'Invalid URL format',
          }),
          origin: 'http://localhost',
        })
      );

      await expect(promise).rejects.toThrow('Invalid URL format');
    });

    it('should use validated origin if available', async () => {
      channel = new MessageChannel(mockWindow, { expectedOrigin: 'http://example.com' });

      void channel.request('modal:ready', undefined).catch(() => {
        // Expected - channel will be disposed
      });

      expect(mockWindow.postMessage).toHaveBeenCalledWith(expect.anything(), 'http://example.com');

      channel.dispose();
    });

    it('should handle concurrent requests', async () => {
      const setupState = createMockState();

      const promise1 = channel.request('modal:ready', undefined);
      const promise2 = channel.request('modal:refresh', undefined);

      const calls = (mockWindow.postMessage as any).mock.calls;
      expect(calls).toHaveLength(2);

      const [msg1] = calls[0];
      const [msg2] = calls[1];

      // Respond to both in reverse order
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.response('modal:refresh', msg2.requestId, { setupState }),
          origin: 'http://localhost',
        })
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.response('modal:ready', msg1.requestId, { setupState }),
          origin: 'http://localhost',
        })
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1.setupState).toEqual(setupState);
      expect(result2.setupState).toEqual(setupState);
    });
  });

  describe('emit()', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow);
    });

    it('should send event message', () => {
      const setupState = createMockState();
      channel.emit('parent:state-update', { setupState });

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'event',
          type: 'parent:state-update',
          payload: { setupState },
        }),
        '*'
      );
    });

    it('should not expect response', () => {
      const setupState = createMockState();
      channel.emit('parent:state-update', { setupState });

      const [msg] = (mockWindow.postMessage as any).mock.calls[0];
      expect(msg).not.toHaveProperty('requestId');
    });

    it('should use validated origin if available', () => {
      channel = new MessageChannel(mockWindow, { expectedOrigin: 'http://example.com' });
      const setupState = createMockState();

      channel.emit('parent:state-update', { setupState });

      expect(mockWindow.postMessage).toHaveBeenCalledWith(expect.anything(), 'http://example.com');
    });
  });

  describe('on()', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow);
    });

    it('should register event handler', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      expect(handler).toHaveBeenCalledWith({ setupState });
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = channel.on('parent:state-update', handler);

      unsubscribe();

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      channel.on('parent:state-update', handler1);
      channel.on('parent:state-update', handler2);

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      expect(handler1).toHaveBeenCalledWith({ setupState });
      expect(handler2).toHaveBeenCalledWith({ setupState });
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      channel.on('parent:state-update', handler);

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      // Wait for async handler
      await vi.runAllTimersAsync();

      expect(handler).toHaveBeenCalledWith({ setupState });
    });

    it('should catch and log handler errors', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      channel.on('parent:state-update', handler);

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('handle()', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow);
    });

    it('should register request handler and respond', async () => {
      const setupState = createMockState();
      const handler = vi.fn().mockResolvedValue({ setupState });

      channel.handle('modal:ready', handler);

      // Simulate incoming request
      const requestMessage = MessageBuilder.request('modal:ready', undefined);
      const testOrigin = 'http://test-handler.com';
      window.dispatchEvent(
        new MessageEvent('message', {
          data: requestMessage,
          origin: testOrigin,
        })
      );

      // Wait for handler
      await vi.runAllTimersAsync();

      expect(handler).toHaveBeenCalledWith(undefined);
      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'response',
          requestId: requestMessage.requestId,
          payload: { setupState },
        }),
        testOrigin // Should use validated origin from incoming message
      );
    });

    it('should send error response if no handler registered', async () => {
      // Create fresh channel to avoid origin from previous tests
      channel.dispose();
      channel = new MessageChannel(mockWindow);

      const requestMessage = MessageBuilder.request('modal:ready', undefined);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: requestMessage,
          origin: 'http://test.com',
        })
      );

      await vi.runAllTimersAsync();

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          requestId: requestMessage.requestId,
          error: expect.objectContaining({
            code: 'NO_HANDLER',
          }),
        }),
        'http://test.com' // Should use validated origin
      );
    });

    it('should send error response if handler throws', async () => {
      // Create fresh channel to avoid origin from previous tests
      channel.dispose();
      channel = new MessageChannel(mockWindow);

      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      channel.handle('modal:ready', handler);

      const requestMessage = MessageBuilder.request('modal:ready', undefined);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: requestMessage,
          origin: 'http://handler-test.com',
        })
      );

      await vi.runAllTimersAsync();

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          requestId: requestMessage.requestId,
          error: expect.objectContaining({
            code: 'HANDLER_ERROR',
            message: 'Handler error',
          }),
        }),
        'http://handler-test.com' // Should use validated origin
      );
    });
  });

  describe('origin validation', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow, { debug: false });
    });

    it('should validate and capture origin on first message', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://origin-a.com',
        })
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(channel.getValidatedOrigin()).toBe('http://origin-a.com');
    });

    it('should reject messages from different origin after validation', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      const setupState = createMockState();

      // First message from origin A
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://origin-a.com',
        })
      );

      expect(handler).toHaveBeenCalledTimes(1);

      // Second message from different origin - ignored
      handler.mockClear();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://origin-b.com',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should use expectedOrigin if provided', () => {
      channel = new MessageChannel(mockWindow, { expectedOrigin: 'http://expected.com' });

      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      const setupState = createMockState();

      // Message from different origin - ignored
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://different.com',
        })
      );

      expect(handler).not.toHaveBeenCalled();

      // Message from expected origin - processed
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://expected.com',
        })
      );

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose()', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow);
    });

    it('should remove event listener', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      channel.dispose();
      expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should reject pending requests', async () => {
      const promise = channel.request('modal:ready', undefined);

      channel.dispose();

      await expect(promise).rejects.toThrow('MessageChannel disposed');
    });

    it('should clear all handlers', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      channel.dispose();

      const setupState = createMockState();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: MessageBuilder.event('parent:state-update', { setupState }),
          origin: 'http://localhost',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        channel.dispose();
        channel.dispose();
      }).not.toThrow();
    });
  });

  describe('non-protocol messages', () => {
    beforeEach(() => {
      channel = new MessageChannel(mockWindow);
    });

    it('should ignore non-object messages', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'not an object',
          origin: 'http://localhost',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore messages without kind field', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'something' },
          origin: 'http://localhost',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore messages with invalid kind', () => {
      const handler = vi.fn();
      channel.on('parent:state-update', handler);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { kind: 'invalid', type: 'something' },
          origin: 'http://localhost',
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
