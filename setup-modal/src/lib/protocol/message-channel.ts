/**
 * MessageChannel - Type-safe bidirectional communication channel
 *
 * Provides Promise-based request/response pattern with:
 * - Type-safe message correlation
 * - Origin validation for security
 * - Timeout management
 * - Event subscription
 */

import { MessageType, RequestPayload, ResponsePayload, RequestId, ProtocolMessage, isResponseMessage, isErrorMessage, isEventMessage, isRequestMessage } from '@/types';
import { MessageBuilder } from './message-builder';

/**
 * Configuration options for MessageChannel
 */
export interface MessageChannelOptions {
  /** Timeout in ms for request/response (default: 30000) */
  timeout?: number;
  /** Expected origin for validation (if null, validates on first message) */
  expectedOrigin?: string | null;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Pending request awaiting response
 */
interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  type: MessageType;
}

/**
 * Event handler function
 */
type EventHandler<T extends MessageType> = (payload: RequestPayload<T>) => void | Promise<void>;

/**
 * Request handler function for responding to incoming requests
 */
type RequestHandler<T extends MessageType> = (payload: RequestPayload<T>) => Promise<ResponsePayload<T>>;

/**
 * Type-safe bidirectional communication channel
 * Manages postMessage communication with type safety and Promise-based API
 */
export class MessageChannel {
  private readonly pendingRequests = new Map<RequestId, PendingRequest>();
  private readonly eventHandlers = new Map<MessageType, Set<EventHandler<any>>>();
  private readonly requestHandlers = new Map<MessageType, RequestHandler<any>>();
  private validatedOrigin: string | null = null;
  private readonly options: Required<MessageChannelOptions>;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(
    private readonly target: Window,
    options: MessageChannelOptions = {}
  ) {
    this.options = {
      timeout: options.timeout ?? 30000,
      expectedOrigin: options.expectedOrigin ?? null,
      debug: options.debug ?? false,
    };

    this.validatedOrigin = this.options.expectedOrigin;
    this.messageListener = this.handleIncomingMessage.bind(this);
    window.addEventListener('message', this.messageListener);

    if (this.options.debug) {
      console.log('[MessageChannel] Initialized', { expectedOrigin: this.validatedOrigin });
    }
  }

  /**
   * Send request and wait for response
   * Returns a Promise that resolves with the typed response payload
   *
   * @param type - Message type from registry
   * @param payload - Typed request payload
   * @returns Promise resolving to typed response payload
   * @throws Error if request times out or receives error response
   */
  async request<T extends MessageType>(type: T, payload: RequestPayload<T>): Promise<ResponsePayload<T>> {
    const message = MessageBuilder.request(type, payload);

    return new Promise<ResponsePayload<T>>((resolve, reject) => {
      // Set up timeout
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new Error(`Request timeout after ${this.options.timeout}ms: ${type}`));
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(message.requestId, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timeoutId,
        type,
      });

      // Send message
      const targetOrigin = this.validatedOrigin || '*';
      if (this.options.debug) {
        console.log('[MessageChannel] Sending request', { type, requestId: message.requestId, targetOrigin });
      }
      this.target.postMessage(message, targetOrigin);
    });
  }

  /**
   * Send event (fire-and-forget)
   * No response expected
   *
   * @param type - Message type from registry
   * @param payload - Typed event payload
   */
  emit<T extends MessageType>(type: T, payload: RequestPayload<T>): void {
    const message = MessageBuilder.event(type, payload);
    const targetOrigin = this.validatedOrigin || '*';

    if (this.options.debug) {
      console.log('[MessageChannel] Sending event', { type, targetOrigin });
    }
    this.target.postMessage(message, targetOrigin);
  }

  /**
   * Listen for events of specific type
   * Returns unsubscribe function
   *
   * @param type - Message type to listen for
   * @param handler - Handler function receiving typed payload
   * @returns Unsubscribe function
   */
  on<T extends MessageType>(type: T, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);

    if (this.options.debug) {
      console.log('[MessageChannel] Event handler registered', { type });
    }

    // Return unsubscribe function
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

  /**
   * Register handler for incoming requests
   * Handler should return Promise with response payload
   *
   * @param type - Message type to handle
   * @param handler - Async handler function returning typed response
   */
  handle<T extends MessageType>(type: T, handler: RequestHandler<T>): void {
    this.requestHandlers.set(type, handler);

    if (this.options.debug) {
      console.log('[MessageChannel] Request handler registered', { type });
    }
  }

  /**
   * Validate message origin
   * On first message, captures and validates origin
   * Subsequent messages must match validated origin
   */
  private validateOrigin(event: MessageEvent): boolean {
    // If origin already validated, check match
    if (this.validatedOrigin !== null) {
      if (event.origin !== this.validatedOrigin) {
        if (this.options.debug) {
          console.warn('[MessageChannel] Origin mismatch', {
            expected: this.validatedOrigin,
            actual: event.origin,
          });
        }
        return false;
      }
      return true;
    }

    // First message - validate and capture origin
    // For iframe contexts, we expect parent origin
    // In development, we might accept any origin
    this.validatedOrigin = event.origin;

    if (this.options.debug) {
      console.log('[MessageChannel] Origin validated', { origin: this.validatedOrigin });
    }
    return true;
  }

  /**
   * Handle incoming postMessage events
   */
  private handleIncomingMessage(event: MessageEvent): void {
    // Validate origin
    if (!this.validateOrigin(event)) {
      return;
    }

    // Validate message structure
    const message = event.data;
    if (!message || typeof message !== 'object' || !('kind' in message)) {
      // Not a protocol message, ignore
      return;
    }

    const protocolMessage = message as ProtocolMessage;

    if (this.options.debug) {
      console.log('[MessageChannel] Received message', { kind: protocolMessage.kind, message: protocolMessage });
    }

    // Route message based on kind
    if (isResponseMessage(protocolMessage)) {
      this.handleResponse(protocolMessage);
    } else if (isErrorMessage(protocolMessage)) {
      this.handleError(protocolMessage);
    } else if (isEventMessage(protocolMessage)) {
      this.handleEvent(protocolMessage);
    } else if (isRequestMessage(protocolMessage)) {
      this.handleRequest(protocolMessage);
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(message: ProtocolMessage): void {
    if (!isResponseMessage(message)) return;

    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      if (this.options.debug) {
        console.warn('[MessageChannel] Received response for unknown request', { requestId: message.requestId });
      }
      return;
    }

    // Clear timeout and remove from pending
    window.clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(message.requestId);

    // Resolve promise
    pending.resolve(message.payload);
  }

  /**
   * Handle error message
   */
  private handleError(message: ProtocolMessage): void {
    if (!isErrorMessage(message)) return;

    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      if (this.options.debug) {
        console.warn('[MessageChannel] Received error for unknown request', { requestId: message.requestId });
      }
      return;
    }

    // Clear timeout and remove from pending
    window.clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(message.requestId);

    // Reject promise with error
    const error = new Error(message.error.message);
    (error as any).code = message.error.code;
    (error as any).details = message.error.details;
    pending.reject(error);
  }

  /**
   * Handle event message
   */
  private handleEvent(message: ProtocolMessage): void {
    if (!isEventMessage(message)) return;

    const handlers = this.eventHandlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      if (this.options.debug) {
        console.log('[MessageChannel] No handlers for event', { type: message.type });
      }
      return;
    }

    // Call all registered handlers
    handlers.forEach(handler => {
      try {
        const result = handler(message.payload);
        // If handler returns Promise, handle errors
        if (result && typeof result.then === 'function') {
          result.catch(err => {
            console.error('[MessageChannel] Event handler error', { type: message.type, error: err });
          });
        }
      } catch (err) {
        console.error('[MessageChannel] Event handler error', { type: message.type, error: err });
      }
    });
  }

  /**
   * Handle incoming request message
   */
  private async handleRequest(message: ProtocolMessage): Promise<void> {
    if (!isRequestMessage(message)) return;

    const handler = this.requestHandlers.get(message.type);
    if (!handler) {
      // No handler registered, send error response
      const errorResponse = MessageBuilder.error(message.requestId, {
        code: 'NO_HANDLER',
        message: `No handler registered for message type: ${message.type}`,
      });
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(errorResponse, targetOrigin);
      return;
    }

    try {
      // Call handler and send response
      const responsePayload = await handler(message.payload);
      const response = MessageBuilder.response(message.type, message.requestId, responsePayload);
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(response, targetOrigin);
    } catch (err) {
      // Handler threw error, send error response
      const errorResponse = MessageBuilder.error(message.requestId, {
        code: 'HANDLER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err,
      });
      const targetOrigin = this.validatedOrigin || '*';
      this.target.postMessage(errorResponse, targetOrigin);
    }
  }

  /**
   * Get validated parent origin
   * Returns null if origin not yet validated
   */
  getValidatedOrigin(): string | null {
    return this.validatedOrigin;
  }

  /**
   * Cleanup - remove event listeners and clear pending requests
   * Should be called when channel is no longer needed
   */
  dispose(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // Clear all pending requests with rejection
    this.pendingRequests.forEach(pending => {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error('MessageChannel disposed'));
    });
    this.pendingRequests.clear();

    // Clear all handlers
    this.eventHandlers.clear();
    this.requestHandlers.clear();

    if (this.options.debug) {
      console.log('[MessageChannel] Disposed');
    }
  }
}
