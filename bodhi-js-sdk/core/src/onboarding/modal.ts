/**
 * OnboardingModal manages the setup-modal lifecycle
 * Uses sandboxed iframe with chrome.runtime.getURL() to allow inline scripts
 * Sandbox attributes 'allow-scripts' and 'allow-same-origin' bypass extension CSP
 * Falls back to sandboxed srcdoc for non-extension environments
 */

import type { MessageType, RequestMessage, ResponsePayload } from '@bodhiapp/setup-modal-types';
import type * as ModalTypes from '@bodhiapp/setup-modal-types';
import { MSG, isRequestMessage, DEFAULT_SETUP_STATE } from '@bodhiapp/setup-modal-types';
import { buildEvent, buildResponse, buildError } from '../types';
import modalHtml from './modal.html?raw';

/**
 * Async handler for modal requests
 * Supports both sync and async responses
 */
export type AsyncRequestHandler<K extends MessageType> =
  | ((msg: RequestMessage<K>) => Promise<ResponsePayload<K>>)
  | ((msg: RequestMessage<K>) => ResponsePayload<K>);

/**
 * Map of message types to async request handlers
 */
export type AsyncRequestHandlers = {
  [K in MessageType]?: AsyncRequestHandler<K>;
};

export type ModalEvent =
  | 'complete'
  | 'close'
  | 'refresh'
  | 'lna_connect'
  | 'lna_skip'
  | 'confirm_server_install'
  | 'select_connection';

/**
 * Event payload types for type-safe event handlers
 */
export interface ModalEventMap {
  complete: [];
  close: [];
  refresh: [];
  lna_connect: [serverUrl: string];
  lna_skip: [];
  confirm_server_install: [];
  select_connection: [connection: 'lna' | 'extension'];
}

/**
 * Configuration options for OnboardingModal
 */
export interface OnboardingModalConfig {
  /**
   * Path to modal HTML file relative to extension root
   * Used with chrome.runtime.getURL() in extension context
   * @default 'src/bodhi-js-core/setup-modal.html'
   */
  modalHtmlPath?: string;

  /**
   * Message handlers for iframe requests
   * Required - delegates all business logic to external handlers
   */
  handlers: AsyncRequestHandlers;
}

/**
 * OnboardingModal manages the setup modal iframe
 * Infrastructure layer only - delegates business logic to handlers
 */
export class OnboardingModal {
  private overlayElement: HTMLDivElement | null = null;
  private iframeElement: HTMLIFrameElement | null = null;
  private isIframeReady = false;
  private currentSetupState: ModalTypes.SetupState | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private modalHtmlPath: string;
  private handlers: AsyncRequestHandlers;

  constructor(config: OnboardingModalConfig) {
    // Initialize modal HTML path from config or use default
    this.modalHtmlPath = config.modalHtmlPath ?? 'src/bodhi-js-core/setup-modal.html';

    // Store handlers for message delegation
    this.handlers = config.handlers;
  }

  /**
   * Show the modal with the given state
   * State building is handled by SetupModalProcessor
   */
  show(state: ModalTypes.SetupState): void {
    if (this.overlayElement) {
      return; // Already shown
    }

    // Store state for later updates
    this.currentSetupState = state;

    // Create overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.setAttribute('data-testid', 'div-setup-overlay');
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create iframe
    this.iframeElement = document.createElement('iframe');
    this.iframeElement.setAttribute('data-testid', 'iframe-setup');

    // Use src with chrome.runtime.getURL instead of srcdoc to avoid CSP issues
    // In extension context, chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      // Sandbox allows inline scripts which are blocked by extension CSP
      this.iframeElement.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups');
      this.iframeElement.src = chrome.runtime.getURL(this.modalHtmlPath);
    } else {
      // Fallback for non-extension environments (e.g., web mode)
      // Only allow-scripts (no allow-same-origin to avoid sandbox escape warning)
      this.iframeElement.sandbox.add('allow-scripts', 'allow-popups');
      this.iframeElement.srcdoc = modalHtml;
    }

    this.iframeElement.style.cssText = `
      width: 90%;
      max-width: 800px;
      height: 90%;
      max-height: 600px;
      border: none;
      border-radius: 8px;
      background: white;
    `;

    // Add iframe to overlay
    this.overlayElement.appendChild(this.iframeElement);

    // Add overlay to body
    document.body.appendChild(this.overlayElement);

    // Setup message listener
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Show the modal with default loading state
   * Used to display modal immediately while state is being built
   */
  showLoading(): void {
    this.show(DEFAULT_SETUP_STATE);
  }

  /**
   * Update the modal state
   * Used by SetupModalProcessor to push state updates to the modal
   */
  updateState(state: ModalTypes.SetupState): void {
    this.currentSetupState = state;
    this.sendStateToModal();
  }

  /**
   * Destroy the modal and clean up
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.iframeElement = null;
    }

    this.isIframeReady = false;
    this.currentSetupState = null;
  }

  /**
   * Handle postMessage from iframe
   * Pure routing - delegates to external handlers
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    const message = event.data;

    // Validate message type and source
    if (!isRequestMessage(message)) return;
    if (event.source !== this.iframeElement?.contentWindow) {
      return;
    }

    // Get handler for this message type
    const handler = this.handlers[message.type as MessageType];
    if (!handler) {
      console.warn('[OnboardingModal] No handler for message type:', message.type);
      return;
    }

    try {
      // Mark iframe as ready on MODAL_READY
      if (message.type === MSG.MODAL_READY) {
        this.isIframeReady = true;
      }

      // Delegate to handler (supports async)
      // Note: TypeScript can't narrow handler/message type correlation, but runtime is safe

      const payload = await handler(message as any);

      // Build and send response
      const response = buildResponse(message.requestId, message.type, payload);
      this.iframeElement?.contentWindow?.postMessage(response, '*');
    } catch (error) {
      console.error('[OnboardingModal] Handler error:', error);
      const errorResponse = buildError(message.requestId, {
        code: 'handler-error',
        message: error instanceof Error ? error.message : 'Handler execution failed',
      });
      this.iframeElement?.contentWindow?.postMessage(errorResponse, '*');
    }
  }

  /**
   * Send current state to modal iframe using event message
   */
  private sendStateToModal(): void {
    if (!this.isIframeReady || !this.iframeElement || !this.currentSetupState) {
      return;
    }

    const event = buildEvent('parent:state-update', {
      setupState: this.currentSetupState,
    });
    this.iframeElement.contentWindow?.postMessage(event, '*');
  }
}
