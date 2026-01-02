/**
 * Unit tests for MessageBuilder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBuilder } from './message-builder';
import { RequestId } from '@/types';

// Mock crypto.randomUUID
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `mock-uuid-${uuidCounter++}`,
  });
});

describe('MessageBuilder', () => {
  describe('request', () => {
    it('should create request message with void payload', () => {
      const msg = MessageBuilder.request('modal:ready', undefined);

      expect(msg).toEqual({
        kind: 'request',
        type: 'modal:ready',
        requestId: 'mock-uuid-0',
        payload: undefined,
      });
    });

    it('should create request message with object payload', () => {
      const msg = MessageBuilder.request('modal:lna:connect', { serverUrl: 'http://localhost:1135' });

      expect(msg).toEqual({
        kind: 'request',
        type: 'modal:lna:connect',
        requestId: 'mock-uuid-0',
        payload: { serverUrl: 'http://localhost:1135' },
      });
    });

    it('should generate unique requestId for each call', () => {
      const msg1 = MessageBuilder.request('modal:ready', undefined);
      const msg2 = MessageBuilder.request('modal:ready', undefined);

      expect(msg1.requestId).not.toBe(msg2.requestId);
    });
  });

  describe('response', () => {
    it('should create response message with void payload', () => {
      const requestId = 'test-request-id' as RequestId;
      const msg = MessageBuilder.response('modal:close', requestId, undefined);

      expect(msg).toEqual({
        kind: 'response',
        type: 'modal:close',
        requestId: 'test-request-id',
        payload: undefined,
      });
    });

    it('should create response message with object payload', () => {
      const requestId = 'test-request-id' as RequestId;
      const setupState = { env: { os: 'macos' as const, browser: 'chrome' as const } };
      const msg = MessageBuilder.response('modal:ready', requestId, { setupState: setupState as any });

      expect(msg).toEqual({
        kind: 'response',
        type: 'modal:ready',
        requestId: 'test-request-id',
        payload: { setupState },
      });
    });

    it('should preserve requestId from original request', () => {
      const originalRequestId = 'original-123' as RequestId;
      const msg = MessageBuilder.response('modal:refresh', originalRequestId, { setupState: {} as any });

      expect(msg.requestId).toBe(originalRequestId);
    });
  });

  describe('error', () => {
    it('should create error message with code and message', () => {
      const requestId = 'test-request-id' as RequestId;
      const msg = MessageBuilder.error(requestId, {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
      });

      expect(msg).toEqual({
        kind: 'error',
        requestId: 'test-request-id',
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server',
        },
      });
    });

    it('should create error message with details', () => {
      const requestId = 'test-request-id' as RequestId;
      const msg = MessageBuilder.error(requestId, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'serverUrl', value: 'invalid-url' },
      });

      expect(msg).toEqual({
        kind: 'error',
        requestId: 'test-request-id',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'serverUrl', value: 'invalid-url' },
        },
      });
    });
  });

  describe('event', () => {
    it('should create event message with payload', () => {
      const setupState = { env: { os: 'macos' as const, browser: 'chrome' as const } };
      const msg = MessageBuilder.event('parent:state-update', { setupState: setupState as any });

      expect(msg).toEqual({
        kind: 'event',
        type: 'parent:state-update',
        payload: { setupState },
      });
    });

    it('should not include requestId in event message', () => {
      const msg = MessageBuilder.event('parent:state-update', { setupState: {} as any });

      expect(msg).not.toHaveProperty('requestId');
    });
  });
});
