/**
 * OnboardingModalV2 — iframe lifecycle for setup-modal-v2.
 *
 * Thinner than v1's OnboardingModal because v2 has a simpler message surface
 * (5 types) and a flat probeStatus state model. Business logic lives in the
 * host processor (SetupModalV2Processor in react-core); this class only
 * manages the iframe and routes postMessages.
 */

import type {
  MessageTypeV2,
  RequestMessageV2,
  ResponsePayloadV2,
  SetupStateV2,
} from '@bodhiapp/setup-modal-v2-types';
import { DEFAULT_SETUP_STATE_V2, MSG_V2, isRequestMessageV2 } from '@bodhiapp/setup-modal-v2-types';
import modalV2Html from './modal-v2.html?raw';

export type AsyncRequestHandlerV2<K extends MessageTypeV2> =
  | ((msg: RequestMessageV2<K>) => Promise<ResponsePayloadV2<K>>)
  | ((msg: RequestMessageV2<K>) => ResponsePayloadV2<K>);

export type AsyncRequestHandlersV2 = {
  [K in MessageTypeV2]?: AsyncRequestHandlerV2<K>;
};

export interface OnboardingModalV2Config {
  /**
   * Path to the modal-v2 HTML relative to extension root. Used with
   * chrome.runtime.getURL in extension contexts.
   *
   * @default 'src/bodhi-js-core/setup-modal-v2.html'
   */
  modalHtmlPath?: string;

  /** Message handlers for iframe-to-host requests. */
  handlers: AsyncRequestHandlersV2;
}

export class OnboardingModalV2 {
  private overlayElement: HTMLDivElement | null = null;
  private iframeElement: HTMLIFrameElement | null = null;
  private isIframeReady = false;
  private currentSetupState: SetupStateV2 | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private modalHtmlPath: string;
  private handlers: AsyncRequestHandlersV2;

  constructor(config: OnboardingModalV2Config) {
    this.modalHtmlPath = config.modalHtmlPath ?? 'src/bodhi-js-core/setup-modal-v2.html';
    this.handlers = config.handlers;
  }

  show(state: SetupStateV2): void {
    if (this.overlayElement) return;

    this.currentSetupState = state;

    this.overlayElement = document.createElement('div');
    this.overlayElement.setAttribute('data-testid', 'div-setup-overlay-v2');
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

    this.iframeElement = document.createElement('iframe');
    this.iframeElement.setAttribute('data-testid', 'iframe-setup-v2');

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      this.iframeElement.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups');
      this.iframeElement.src = chrome.runtime.getURL(this.modalHtmlPath);
    } else {
      this.iframeElement.sandbox.add('allow-scripts', 'allow-popups');
      this.iframeElement.srcdoc = modalV2Html;
    }

    this.iframeElement.allow = 'clipboard-write';
    this.iframeElement.style.cssText = `
      width: 90%;
      max-width: 520px;
      height: 80vh;
      max-height: 480px;
      border: none;
      border-radius: 12px;
      background: white;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    this.overlayElement.appendChild(this.iframeElement);
    document.body.appendChild(this.overlayElement);

    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  showLoading(): void {
    this.show(DEFAULT_SETUP_STATE_V2);
  }

  updateState(state: SetupStateV2): void {
    this.currentSetupState = state;
    this.sendStateToModal();
  }

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

  private async handleMessage(event: MessageEvent): Promise<void> {
    const message = event.data;

    if (!isRequestMessageV2(message)) return;
    if (event.source !== this.iframeElement?.contentWindow) return;

    const handler = this.handlers[message.type as MessageTypeV2];
    if (!handler) {
      console.warn('[OnboardingModalV2] No handler for message type:', message.type);
      return;
    }

    try {
      if (message.type === MSG_V2.MODAL_READY) {
        this.isIframeReady = true;
      }

      const payload = await handler(message as any);
      const response = {
        kind: 'response' as const,
        type: message.type,
        requestId: message.requestId,
        payload,
      };
      this.iframeElement?.contentWindow?.postMessage(response, '*');
    } catch (error) {
      console.error('[OnboardingModalV2] Handler error:', error);
      const errorResponse = {
        kind: 'error' as const,
        requestId: message.requestId,
        error: {
          code: 'handler-error',
          message: error instanceof Error ? error.message : 'Handler execution failed',
        },
      };
      this.iframeElement?.contentWindow?.postMessage(errorResponse, '*');
    }
  }

  private sendStateToModal(): void {
    if (!this.isIframeReady || !this.iframeElement || !this.currentSetupState) return;

    const event = {
      kind: 'event' as const,
      type: MSG_V2.PARENT_STATE_UPDATE,
      payload: this.currentSetupState,
    };
    this.iframeElement.contentWindow?.postMessage(event, '*');
  }
}
