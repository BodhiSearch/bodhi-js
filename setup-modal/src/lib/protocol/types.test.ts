/**
 * Unit tests for protocol core types and type guards
 */

import { describe, it, expect } from 'vitest';
import { isRequestMessage, isResponseMessage, isErrorMessage, isEventMessage, RequestMessage, ResponseMessage, ErrorMessage, EventMessage, RequestId } from '@/types';

describe('Protocol Type Guards', () => {
  const mockRequestId = 'test-request-id' as RequestId;

  describe('isRequestMessage', () => {
    it('should return true for valid request message', () => {
      const msg: RequestMessage = {
        kind: 'request',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: undefined,
      };
      expect(isRequestMessage(msg)).toBe(true);
    });

    it('should return false for response message', () => {
      const msg: ResponseMessage = {
        kind: 'response',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: { setupState: {} as any },
      };
      expect(isRequestMessage(msg)).toBe(false);
    });

    it('should return false for error message', () => {
      const msg: ErrorMessage = {
        kind: 'error',
        requestId: mockRequestId,
        error: { code: 'TEST_ERROR', message: 'Test error' },
      };
      expect(isRequestMessage(msg)).toBe(false);
    });

    it('should return false for event message', () => {
      const msg: EventMessage = {
        kind: 'event',
        type: 'parent:state-update',
        payload: { setupState: {} as any },
      };
      expect(isRequestMessage(msg)).toBe(false);
    });
  });

  describe('isResponseMessage', () => {
    it('should return true for valid response message', () => {
      const msg: ResponseMessage = {
        kind: 'response',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: { setupState: {} as any },
      };
      expect(isResponseMessage(msg)).toBe(true);
    });

    it('should return false for request message', () => {
      const msg: RequestMessage = {
        kind: 'request',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: undefined,
      };
      expect(isResponseMessage(msg)).toBe(false);
    });
  });

  describe('isErrorMessage', () => {
    it('should return true for valid error message', () => {
      const msg: ErrorMessage = {
        kind: 'error',
        requestId: mockRequestId,
        error: { code: 'TEST_ERROR', message: 'Test error' },
      };
      expect(isErrorMessage(msg)).toBe(true);
    });

    it('should return false for request message', () => {
      const msg: RequestMessage = {
        kind: 'request',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: undefined,
      };
      expect(isErrorMessage(msg)).toBe(false);
    });

    it('should handle error with details', () => {
      const msg: ErrorMessage = {
        kind: 'error',
        requestId: mockRequestId,
        error: {
          code: 'DETAILED_ERROR',
          message: 'Detailed error',
          details: { foo: 'bar', nested: { value: 42 } },
        },
      };
      expect(isErrorMessage(msg)).toBe(true);
      expect(msg.error.details).toEqual({ foo: 'bar', nested: { value: 42 } });
    });
  });

  describe('isEventMessage', () => {
    it('should return true for valid event message', () => {
      const msg: EventMessage = {
        kind: 'event',
        type: 'parent:state-update',
        payload: { setupState: {} as any },
      };
      expect(isEventMessage(msg)).toBe(true);
    });

    it('should return false for request message', () => {
      const msg: RequestMessage = {
        kind: 'request',
        type: 'modal:ready',
        requestId: mockRequestId,
        payload: undefined,
      };
      expect(isEventMessage(msg)).toBe(false);
    });
  });
});
