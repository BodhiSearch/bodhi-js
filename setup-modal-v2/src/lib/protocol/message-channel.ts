import type { MessageTypeV2, RequestPayloadV2, ResponsePayloadV2, RequestIdV2, ProtocolMessageV2 } from '@/types';
import { isResponseMessageV2, isErrorMessageV2, isEventMessageV2, isRequestMessageV2 } from '@/types';
import { MessageBuilderV2 } from './message-builder';

export interface MessageChannelV2Options {
  timeout?: number;
  expectedOrigin?: string | null;
  debug?: boolean;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  type: MessageTypeV2;
}

type EventHandler<T extends MessageTypeV2> = (payload: RequestPayloadV2<T>) => void | Promise<void>;
type RequestHandler<T extends MessageTypeV2> = (payload: RequestPayloadV2<T>) => Promise<ResponsePayloadV2<T>>;

/**
 * Bidirectional type-safe postMessage channel for setup-modal-v2.
 *
 * Same mechanics as v1's MessageChannel but parameterized on the v2 registry.
 * Requests resolve via UUID correlation; events are fire-and-forget.
 */
export class MessageChannelV2 {
  private readonly pendingRequests = new Map<RequestIdV2, PendingRequest>();
  private readonly eventHandlers = new Map<MessageTypeV2, Set<EventHandler<any>>>();
  private readonly requestHandlers = new Map<MessageTypeV2, RequestHandler<any>>();
  private validatedOrigin: string | null = null;
  private readonly options: Required<MessageChannelV2Options>;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(
    private readonly target: Window,
    options: MessageChannelV2Options = {}
  ) {
    this.options = {
      timeout: options.timeout ?? 1000,
      expectedOrigin: options.expectedOrigin ?? null,
      debug: options.debug ?? false,
    };

    this.validatedOrigin = this.options.expectedOrigin;
    this.messageListener = this.handleIncomingMessage.bind(this);
    window.addEventListener('message', this.messageListener);

    if (this.options.debug) {
      console.log('[MessageChannelV2] Initialized', { expectedOrigin: this.validatedOrigin });
    }
  }

  async request<T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>): Promise<ResponsePayloadV2<T>> {
    const message = MessageBuilderV2.request(type, payload);

    return new Promise<ResponsePayloadV2<T>>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new Error(`Request timeout after ${this.options.timeout}ms: ${type}`));
      }, this.options.timeout);

      this.pendingRequests.set(message.requestId, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timeoutId,
        type,
      });

      const targetOrigin = this.validatedOrigin || '*';
      if (this.options.debug) {
        console.log('[MessageChannelV2] Sending request', {
          type,
          requestId: message.requestId,
          targetOrigin,
        });
      }
      this.target.postMessage(message, targetOrigin);
    });
  }

  emit<T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>): void {
    const message = MessageBuilderV2.event(type, payload);
    const targetOrigin = this.validatedOrigin || '*';

    if (this.options.debug) {
      console.log('[MessageChannelV2] Sending event', { type, targetOrigin });
    }
    this.target.postMessage(message, targetOrigin);
  }

  on<T extends MessageTypeV2>(type: T, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);

    return () => {
      const handlers = this.eventHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(type);
        }
      }
    };
  }

  handle<T extends MessageTypeV2>(type: T, handler: RequestHandler<T>): void {
    this.requestHandlers.set(type, handler);
  }

  getValidatedOrigin(): string | null {
    return this.validatedOrigin;
  }

  dispose(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    this.pendingRequests.forEach(pending => {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error('MessageChannelV2 disposed'));
    });
    this.pendingRequests.clear();

    this.eventHandlers.clear();
    this.requestHandlers.clear();
  }

  private validateOrigin(event: MessageEvent): boolean {
    if (this.validatedOrigin !== null) {
      if (event.origin !== this.validatedOrigin) {
        if (this.options.debug) {
          console.warn('[MessageChannelV2] Origin mismatch', {
            expected: this.validatedOrigin,
            actual: event.origin,
          });
        }
        return false;
      }
      return true;
    }

    this.validatedOrigin = event.origin;
    return true;
  }

  private handleIncomingMessage(event: MessageEvent): void {
    if (!this.validateOrigin(event)) return;

    const message = event.data;
    if (!message || typeof message !== 'object' || !('kind' in message)) return;

    const protocolMessage = message as ProtocolMessageV2;

    if (isResponseMessageV2(protocolMessage)) {
      this.handleResponse(protocolMessage);
    } else if (isErrorMessageV2(protocolMessage)) {
      this.handleError(protocolMessage);
    } else if (isEventMessageV2(protocolMessage)) {
      this.handleEvent(protocolMessage);
    } else if (isRequestMessageV2(protocolMessage)) {
      this.handleRequest(protocolMessage);
    }
  }

  private handleResponse(message: ProtocolMessageV2): void {
    if (!isResponseMessageV2(message)) return;

    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) return;

    window.clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(message.requestId);
    pending.resolve(message.payload);
  }

  private handleError(message: ProtocolMessageV2): void {
    if (!isErrorMessageV2(message)) return;

    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) return;

    window.clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(message.requestId);

    const error = new Error(message.error.message);
    (error as any).code = message.error.code;
    (error as any).details = message.error.details;
    pending.reject(error);
  }

  private handleEvent(message: ProtocolMessageV2): void {
    if (!isEventMessageV2(message)) return;

    const handlers = this.eventHandlers.get(message.type);
    if (!handlers || handlers.size === 0) return;

    handlers.forEach(handler => {
      try {
        const result = handler(message.payload);
        if (result && typeof result.then === 'function') {
          result.catch(err => {
            console.error('[MessageChannelV2] Event handler error', { type: message.type, error: err });
          });
        }
      } catch (err) {
        console.error('[MessageChannelV2] Event handler error', { type: message.type, error: err });
      }
    });
  }

  private async handleRequest(message: ProtocolMessageV2): Promise<void> {
    if (!isRequestMessageV2(message)) return;

    const handler = this.requestHandlers.get(message.type);
    if (!handler) {
      const errorResponse = MessageBuilderV2.error(message.requestId, {
        code: 'NO_HANDLER',
        message: `No handler registered for message type: ${message.type}`,
      });
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(errorResponse, targetOrigin);
      return;
    }

    try {
      const responsePayload = await handler(message.payload);
      const response = MessageBuilderV2.response(message.type, message.requestId, responsePayload);
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(response, targetOrigin);
    } catch (err) {
      const errorResponse = MessageBuilderV2.error(message.requestId, {
        code: 'HANDLER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err,
      });
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(errorResponse, targetOrigin);
    }
  }
}
