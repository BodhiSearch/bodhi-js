export type SerializedExt2ExtState = { extensionId?: string };

import {
  INITIAL_AUTH_STATE,
  BACKEND_SERVER_NOT_REACHABLE,
  IExtensionClient,
  Logger,
  NOOP_STATE_CALLBACK,
  PENDING_EXTENSION_READY,
  createApiError,
  createExtensionStateNotFound,
  createExtensionStateNotInitialized,
  createOperationError,
  isApiResultOperationError,
  isApiResultSuccess,
  isAuthError,
  Chat,
  Models,
  Embeddings,
  type ApiResponseResult,
  type AuthState,
  type BackendServerState,
  type ClientState,
  type ExtensionState,
  type InitParams,
  type LoginOptions,
  type LogLevel,
  type ServerInfoResponse,
  type StateChangeCallback,
} from '@bodhiapp/bodhi-js-core';
import { isApiSuccessResponse, isExtError, isOperationError } from '@bodhiapp/bodhi-browser/types';
import {
  DEFAULT_API_TIMEOUT_MS,
  DISCOVERY_TIMEOUT_MS,
  EXT2EXT_CLIENT_ACTIONS,
  EXT2EXT_CLIENT_MESSAGE_TYPES,
  EXT2EXT_CLIENT_STREAM_PORT,
} from './constants';
import type {
  ExtClientApiRequest,
  ExtClientApiRequestMessage,
  ExtClientApiResponseMessage,
  ExtClientRequestMessage,
  ExtClientResponseMessage,
  ExtClientStreamApiErrorMessage,
  ExtClientStreamChunkMessage,
  ExtClientStreamErrorMessage,
  ExtClientStreamMessage,
} from './messages';
import { isExtClientApiError } from './messages';

/**
 * Configuration for ExtClient
 */
export interface ExtClientConfig {
  logLevel?: LogLevel;
  apiTimeoutMs?: number;
  initParams?: {
    extension?: {
      timeoutMs?: number;
      attempts?: number;
      attemptWaitMs?: number;
      attemptTimeout?: number;
    };
  };
}

/**
 * ExtClient - extension-to-extension client for chrome.runtime operations
 *
 * Encapsulates all complexity of communicating with background script
 * for both auth and bodhi-browser-ext operations.
 *
 * Implements IExtensionClient interface with state callback for state changes
 *
 */
export class ExtClient implements IExtensionClient {
  private state: ExtensionState = {
    type: 'extension',
    extension: 'not-initialized',
    extensionId: null,
    server: PENDING_EXTENSION_READY,
  };
  private logger: Logger;
  private onStateChange: StateChangeCallback;
  private extensionId: string | null = null;
  private broadcastListenerActive = false;
  private config: ExtClientConfig;
  private apiTimeoutMs: number;

  // OpenAI-compatible resource namespaces
  private _chat: Chat | undefined;
  private _models: Models | undefined;
  private _embeddings: Embeddings | undefined;

  constructor(config: ExtClientConfig = {}, onStateChange?: StateChangeCallback) {
    this.config = config;
    this.logger = new Logger('ExtClient', config?.logLevel || 'warn');
    this.onStateChange = onStateChange ?? NOOP_STATE_CALLBACK;
    this.apiTimeoutMs = config.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  }

  /**
   * Set client state and notify callback
   */
  private setState(newState: ExtensionState): void {
    this.state = newState;
    this.onStateChange({ type: 'client-state', state: newState });
  }

  /**
   * Set auth state and notify callback
   */
  private setAuthState(authState: AuthState): void {
    this.onStateChange({ type: 'auth-state', state: authState });
  }

  /**
   * Set or update the state change callback
   */
  setStateCallback(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  /**
   * Setup persistent broadcast listener for auth state changes
   * Idempotent - only sets up listener once
   */
  private setupBroadcastListener(): void {
    if (this.broadcastListenerActive) return;
    this.broadcastListenerActive = true;

    chrome.runtime.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string; event?: string };
      if (msg?.type === EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_BROADCAST) {
        if (msg.event === 'authStateChanged') {
          this.handleAuthStateChangedBroadcast();
        }
      }
      return false; // Don't keep message channel open
    });
    this.logger.debug('Broadcast listener setup complete');
  }

  /**
   * Handle authStateChanged broadcast from background
   * Fetches fresh auth state and notifies via callback
   */
  private async handleAuthStateChangedBroadcast(): Promise<void> {
    this.logger.debug('Received authStateChanged broadcast, refreshing auth state');
    const authState = await this.getAuthState();
    this.setAuthState(authState);
  }

  /**
   * Generate a unique request ID for message correlation
   */
  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get current client state
   */
  getState(): ClientState {
    return this.state;
  }

  isClientInitialized(): boolean {
    return this.state.extension === 'ready';
  }

  isServerReady(): boolean {
    return this.isClientInitialized() && this.state.server.status === 'ready';
  }

  /**
   * Initialize extension discovery with optional timeout
   * Returns ExtensionState with extension and server status
   *
   * For sdk/ext:
   * - CAN store extensionId for fast restoration (via SET_EXTENSION_ID)
   * - Avoids chrome.runtime discovery messages on page reload
   */
  async init(params: InitParams = {}): Promise<ExtensionState> {
    // testConnection: false, selectedConnection: false → not-initialized
    if (!params.testConnection && !params.selectedConnection) {
      this.logger.info('No testConnection or selectedConnection, returning not-initialized state');
      const notInitState: ExtensionState = createExtensionStateNotInitialized();
      this.setState(notInitState);
      return notInitState;
    }

    // IDEMPOTENCY: If already initialized and not testing, skip discovery
    if (this.extensionId && !params.testConnection) {
      this.logger.debug('Already initialized with extensionId, skipping discovery');
      return this.state;
    }

    // testConnection: true OR selectedConnection: true → discover extension
    // Use timeoutMs from: InitParams > config > default constant
    const timeoutMs =
      params.timeoutMs ?? this.config.initParams?.extension?.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
    const savedExtensionId = (params.savedState as SerializedExt2ExtState | undefined)?.extensionId;
    try {
      // Only discover/set if not already initialized
      if (!this.extensionId) {
        if (savedExtensionId) {
          // Restore: send SET_EXTENSION_ID to ext2ext-client
          this.logger.info('Restoring with known extensionId:', savedExtensionId);
          await this.sendExtMessageWithTimeout(
            EXT2EXT_CLIENT_ACTIONS.SET_EXTENSION_ID,
            { extensionId: savedExtensionId },
            timeoutMs
          );
          this.extensionId = savedExtensionId;
        } else {
          // Discovery: ask ext2ext-client to discover
          this.logger.info('Discovering bodhi-browser extension...');

          // Build params to send to ext2ext-client (NOT including timeoutMs - that's for sender-side)
          const discoveryParams = {
            attempts: this.config.initParams?.extension?.attempts,
            attemptWaitMs: this.config.initParams?.extension?.attemptWaitMs,
            attemptTimeout: this.config.initParams?.extension?.attemptTimeout,
          };

          const body = (await this.sendExtMessageWithTimeout(
            EXT2EXT_CLIENT_ACTIONS.DISCOVER_EXTENSION,
            discoveryParams,
            timeoutMs
          )) as { extensionId: string };
          this.extensionId = body.extensionId;
          this.logger.info('Extension discovered:', this.extensionId);
        }
        // Setup persistent broadcast listener after successful initialization
        this.setupBroadcastListener();
      }

      // Build state with current extensionId
      const state: ExtensionState = {
        type: 'extension',
        extension: 'ready',
        extensionId: this.extensionId,
        server: PENDING_EXTENSION_READY,
      };
      // Test server connectivity if requested
      let serverState: BackendServerState = PENDING_EXTENSION_READY;
      if (params.testConnection) {
        try {
          serverState = await this.getServerState();
          this.logger.info('Server connectivity tested, state:', serverState.status);
        } catch (error) {
          this.logger.error('Failed to get server state:', error);
          serverState = BACKEND_SERVER_NOT_REACHABLE;
        }
      }
      this.setState({ ...state, server: serverState });
      return this.state;
    } catch (error) {
      this.logger.error('Failed to initialize extension:', error);
      this.extensionId = null; // Reset on failure
      const notFoundState = createExtensionStateNotFound();
      this.setState(notFoundState);
      return this.state;
    }
  }

  /**
   * Helper method to send ext message with timeout support
   */
  private async sendExtMessageWithTimeout<TParams = void, TRes = unknown>(
    action: string,
    params?: TParams,
    timeoutMs: number = 10000
  ): Promise<TRes> {
    const timeoutPromise = new Promise<TRes>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    return Promise.race([this.sendExtRequest<TParams, TRes>(action, params), timeoutPromise]);
  }

  /**
   * Send an EXT2EXT_CLIENT_REQUEST message and await EXT2EXT_CLIENT_RESPONSE
   * Public for generic ext2ext testing
   */
  public async sendExtRequest<TParams = void, TRes = unknown>(
    action: string,
    params?: TParams
  ): Promise<TRes> {
    try {
      const requestId = this.generateRequestId();

      const response = (await chrome.runtime.sendMessage({
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST,
        requestId,
        request: {
          action,
          params,
        },
      } as ExtClientRequestMessage)) as ExtClientResponseMessage;

      if (!response) {
        throw createOperationError('No response from background script', 'extension_error');
      }

      if (response.type !== EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE) {
        throw createOperationError(
          'Invalid response type from background script',
          'extension_error'
        );
      }

      // Check success/error discriminated union (flattened: T | { error: ExtError })
      const res = response.response;
      if (isExtError(res)) {
        const errorType = res.error.type || 'extension_error';
        throw createOperationError(res.error.message, errorType);
      }

      return res as TRes;
    } catch (err) {
      if (isOperationError(err)) {
        throw err;
      }
      throw createOperationError(
        err instanceof Error ? err.message : 'Unknown error occurred',
        'extension_error'
      );
    }
  }

  /**
   * Send an API_REQUEST message and await API_RESPONSE (internal)
   * Returns ext2ext-specific ExtClientApiResponseMessage
   */
  private async sendRawApiMessage<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ExtClientApiResponseMessage<TRes>> {
    const requestId = this.generateRequestId();

    const response = (await chrome.runtime.sendMessage({
      type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_REQUEST,
      requestId,
      request: {
        method,
        endpoint,
        body,
        headers,
        authenticated,
      } as ExtClientApiRequest,
    } as ExtClientApiRequestMessage<TRes>)) as ExtClientApiResponseMessage<TRes>;

    return response;
  }

  /**
   * Send an API message and convert to protocol-agnostic ApiResponseResult
   */
  public async sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponseResult<TRes>> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `[bodhi-js-sdk/ext] network timeout: api request not completed within configured/default timeout of ${this.apiTimeoutMs}ms`
              )
            ),
          this.apiTimeoutMs
        )
      );

      const extResponse = await Promise.race([
        this.sendRawApiMessage<TReq, TRes>(method, endpoint, body, headers, authenticated),
        timeoutPromise,
      ]);

      if (isExtClientApiError(extResponse)) {
        const errorType = extResponse.error.type || 'extension_error';
        return {
          error: {
            message: extResponse.error.message,
            type: errorType,
          },
        };
      }
      return extResponse.response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        error: {
          message: errorMessage,
          type: 'network_error',
        },
      };
    }
  }

  /**
   * Login user via OAuth
   * @param options - Optional login parameters including toolsetScopeIds
   * @throws ExtError if login fails
   * @returns AuthState with login state and user info
   */
  async login(options?: LoginOptions): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      // One-time listener for auth broadcast
      const listener = async (message: unknown) => {
        if (
          message &&
          typeof message === 'object' &&
          'type' in message &&
          message.type === 'EXT2EXT_CLIENT_BROADCAST' &&
          'event' in message &&
          message.event === 'authStateChanged'
        ) {
          chrome.runtime.onMessage.removeListener(listener);

          try {
            const authState = await this.getAuthState();
            if (isAuthError(authState)) {
              reject(
                createOperationError(`Login failed: ${authState.error?.message}`, 'auth-error')
              );
              return;
            }
            if (authState.status !== 'authenticated') {
              reject(createOperationError('Login failed: User is not logged in', 'auth-error'));
              return;
            }
            this.setAuthState(authState);
            resolve(authState);
          } catch (err) {
            reject(err);
          }
        }
      };

      // Add listener BEFORE sending login request
      chrome.runtime.onMessage.addListener(listener);

      // Send login request (opens OAuth popup)
      this.sendExtRequest(EXT2EXT_CLIENT_ACTIONS.LOGIN, options).catch((err) => {
        chrome.runtime.onMessage.removeListener(listener);
        reject(err);
      });
    });
  }

  /**
   * Logout current user
   * @throws ExtError if logout fails
   * @returns AuthLoggedOut with logged out state
   */
  async logout(): Promise<AuthState> {
    await this.sendExtRequest(EXT2EXT_CLIENT_ACTIONS.LOGOUT);

    const result: AuthState = {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      error: null,
    };

    this.setAuthState(result);
    return result;
  }

  /**
   * Get current authentication state
   * @returns AuthState (discriminated union: AuthLoggedIn | AuthLoggedOut)
   * @throws ExtError if request fails
   */
  async getAuthState(): Promise<AuthState> {
    if (!this.isClientInitialized()) {
      return INITIAL_AUTH_STATE;
    }
    const body = await this.sendExtRequest<void, { authState: AuthState }>(
      EXT2EXT_CLIENT_ACTIONS.GET_AUTH_STATE
    );
    return body.authState;
  }

  /**
   * Ping bodhi-browser-ext API via /ping endpoint
   */
  async pingApi(): Promise<ApiResponseResult<{ message: string }>> {
    return this.sendApiRequest<void, { message: string }>('GET', '/ping');
  }

  /**
   * Get backend server state
   * Calls /bodhi/v1/info and returns structured server state
   */
  async getServerState(): Promise<BackendServerState> {
    const result = await this.sendApiRequest<void, ServerInfoResponse>('GET', '/bodhi/v1/info');

    if (isApiResultOperationError(result)) {
      return {
        status: 'not-reachable',
        version: null,
        error: result.error,
      };
    }

    if (!isApiResultSuccess(result)) {
      return {
        status: 'not-reachable',
        version: null,
        error: { message: 'API error from server', type: 'extension_error' },
      };
    }

    const body = result.body;

    switch (body.status) {
      case 'ready':
        return { status: 'ready', version: body.version || 'unknown', error: null };
      case 'setup':
        return {
          status: 'setup',
          version: body.version || 'unknown',
          error: body.error
            ? { message: body.error.message, type: body.error.type }
            : { message: 'Setup required', type: 'extension_error' },
        };
      case 'resource-admin':
        return {
          status: 'resource-admin',
          version: body.version || 'unknown',
          error: body.error
            ? { message: body.error.message, type: body.error.type }
            : { message: 'Resource admin required', type: 'extension_error' },
        };
      case 'error':
        return {
          status: 'error',
          version: body.version || 'unknown',
          error: body.error
            ? { message: body.error.message, type: body.error.type }
            : { message: 'Server error', type: 'extension_error' },
        };
      default:
        return {
          status: 'not-reachable',
          version: null,
          error: { message: 'Unknown server status', type: 'extension_error' },
        };
    }
  }

  // ============================================================================
  // Streaming Methods
  // ============================================================================

  /**
   * Generic streaming method
   */
  async *stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated: boolean = true
  ): AsyncGenerator<TRes> {
    const requestId = this.generateRequestId();

    this.logger.debug('Starting stream', {
      method,
      endpoint,
      requestId,
    });

    const port = chrome.runtime.connect({ name: EXT2EXT_CLIENT_STREAM_PORT });

    const stream = new ReadableStream<TRes>({
      start: (controller) => {
        port.onMessage.addListener((message: ExtClientStreamMessage<TRes>) => {
          if (message.requestId !== requestId) return;

          switch (message.type) {
            case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_DONE:
              this.logger.debug('Stream complete', { requestId });
              controller.close();
              port.disconnect();
              break;

            case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_ERROR:
              this.logger.error('Stream error', {
                requestId,
                error: JSON.stringify((message as ExtClientStreamErrorMessage).error),
              });
              controller.error(
                createOperationError(
                  (message as ExtClientStreamErrorMessage).error.message,
                  'extension_error'
                )
              );
              port.disconnect();
              break;

            case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_API_ERROR: {
              const apiErr = message as ExtClientStreamApiErrorMessage;
              this.logger.error('Stream API error', {
                requestId,
                error: apiErr.response.body?.error,
              });
              controller.error(
                createApiError(
                  apiErr.response.body?.error?.message || 'API error',
                  apiErr.response.status,
                  apiErr.response.body
                )
              );
              port.disconnect();
              break;
            }

            case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_CHUNK: {
              // response field (not chunk)
              const chunkMsg = message as ExtClientStreamChunkMessage<TRes>;
              if (isApiSuccessResponse(chunkMsg.response)) {
                controller.enqueue(chunkMsg.response.body);
              }
              break;
            }
          }
        });

        port.onDisconnect.addListener(() => {
          this.logger.debug('Port disconnected', { requestId });
          try {
            controller.error(
              createOperationError('Connection closed unexpectedly', 'extension_error')
            );
          } catch {
            // Controller already closed
          }
        });

        // Flat request structure
        port.postMessage({
          type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_REQUEST,
          requestId,
          request: { method, endpoint, body, headers, authenticated },
        });
      },
    });

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.logger.debug('Stream iteration complete');
          break;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============================================================================
  // OpenAI-Compatible Namespaced API
  // ============================================================================

  get chat(): Chat {
    return (this._chat ??= new Chat(this));
  }

  get models(): Models {
    return (this._models ??= new Models(this));
  }

  get embeddings(): Embeddings {
    return (this._embeddings ??= new Embeddings(this));
  }

  /**
   * Serialize ext2ext client state for persistence
   */
  serialize(): SerializedExt2ExtState {
    return { extensionId: this.extensionId ?? undefined };
  }

  /**
   * Debug dump of ExtClient internal state
   */
  async debug(): Promise<Record<string, unknown>> {
    return {
      type: 'ExtClient',
      state: this.state,
      authState: await this.getAuthState(),
    };
  }
}
