/**
 * Message Type Registry - Single source of truth for all protocol message types
 *
 * This registry maps message type strings to their payload/response shapes.
 * All other types (RequestPayload, ResponsePayload, etc.) are derived from this registry.
 *
 * Design: Each entry defines:
 * - request: The payload type sent with the request
 * - response: The payload type expected in the response
 *
 * For events (one-way messages), response is void.
 */

import type { SetupState } from './state';

/**
 * Central registry mapping message types to their payload/response shapes
 * Single source of truth - everything else is inferred!
 */
export interface MessageTypeRegistry {
  // === Modal → Parent (Commands) ===

  /**
   * Modal is ready and requesting initial state
   * Sent on modal mount
   */
  'modal:ready': {
    request: void;
    response: { setupState: SetupState };
  };

  /**
   * User requested to refresh platform detection
   * Triggers re-detection of browser, OS, extension, server
   */
  'modal:refresh': {
    request: void;
    response: { setupState: SetupState };
  };

  /**
   * User requested to close the modal
   * Parent should hide/destroy modal
   */
  'modal:close': {
    request: void;
    response: void;
  };

  /**
   * Setup completed successfully
   * Signals parent that user has finished setup
   */
  'modal:complete': {
    request: void;
    response: void;
  };

  /**
   * User requested LNA connection to specific server URL
   * Triggers LNA permission request and connection attempt
   */
  'modal:lna:connect': {
    request: { serverUrl: string };
    response: { success: boolean };
  };

  /**
   * User chose to skip LNA setup
   * Falls back to extension-only mode
   */
  'modal:lna:skip': {
    request: void;
    response: { success: boolean };
  };

  /**
   * User confirmed server installation status
   * Used when server needs to be installed
   */
  'modal:confirm-server-install': {
    request: { confirmed: boolean };
    response: { success: boolean };
  };

  /**
   * User selected preferred connection method
   * Allows choosing between LNA and Extension paths
   */
  'modal:select-connection': {
    request: { connection: 'lna' | 'extension' };
    response: { success: boolean };
  };

  // === Parent → Modal (Events) ===

  /**
   * Parent sending updated state to modal
   * Fired when platform detection results change
   */
  'parent:state-update': {
    request: { setupState: SetupState };
    response: void;
  };
}

// === Derived Types with Full Inference ===

/**
 * Union of all valid message type strings
 * Derived from MessageTypeRegistry keys
 */
export type MessageType = keyof MessageTypeRegistry;

/**
 * Extract request payload type for a given message type
 * Returns the 'request' field from the registry entry
 */
export type RequestPayload<T extends MessageType> = MessageTypeRegistry[T]['request'];

/**
 * Extract response payload type for a given message type
 * Returns the 'response' field from the registry entry
 */
export type ResponsePayload<T extends MessageType> = MessageTypeRegistry[T]['response'];

/**
 * Message type constants - Type-safe identifiers
 *
 * @example
 * switch (message.type) {
 *   case MSG.MODAL_READY:
 *     // Type-safe constant, no typos possible
 *     break;
 * }
 */
export const MSG = {
  // Modal lifecycle
  MODAL_READY: 'modal:ready',
  MODAL_REFRESH: 'modal:refresh',
  MODAL_CLOSE: 'modal:close',
  MODAL_COMPLETE: 'modal:complete',

  // LNA actions
  MODAL_LNA_CONNECT: 'modal:lna:connect',
  MODAL_LNA_SKIP: 'modal:lna:skip',

  // Server confirmation
  MODAL_CONFIRM_SERVER_INSTALL: 'modal:confirm-server-install',

  // Connection selection
  MODAL_SELECT_CONNECTION: 'modal:select-connection',

  // Parent → Modal events
  PARENT_STATE_UPDATE: 'parent:state-update',
} as const;

/**
 * Type guard that narrows RequestMessage to specific type WITH payload typing
 *
 * Use this for full type safety when you need access to typed payload fields.
 * The guard narrows the generic RequestMessage to RequestMessage<T> where T
 * determines the payload type.
 *
 * @example
 * if (isMessageType(msg, MSG.MODAL_LNA_CONNECT)) {
 *   // msg.payload is { serverUrl: string } - fully typed!
 *   console.log(msg.payload.serverUrl); // Autocomplete works!
 * }
 */
export function isMessageType<T extends MessageType>(msg: { type: string }, type: T): msg is { type: T } {
  return msg.type === type;
}

/**
 * Type-safe request handler map
 * Enforces correct payload access AND correct return type for each message
 *
 * Each handler receives a RequestMessage<K> where K is the specific message type,
 * providing full type safety for payload access. The handler must return the
 * correct ResponsePayload<K> type.
 */
export type RequestHandlers = {
  [K in MessageType]?: (msg: { type: K; requestId: string; payload: RequestPayload<K> }) => ResponsePayload<K>;
};
