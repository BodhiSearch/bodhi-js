// Import types from local modules
import type {
  BodhiErrorResponse,
  CreateAccessRequest,
  CreateAccessRequestResponse,
} from '@bodhiapp/ts-client';
import {
  DISCOVERY_ATTEMPTS,
  DISCOVERY_ATTEMPT_TIMEOUT,
  DISCOVERY_ATTEMPT_WAIT_MS,
  EXT2EXT_CLIENT_ACTIONS,
  EXT2EXT_CLIENT_MESSAGE_TYPES,
  EXT2EXT_CLIENT_STREAM_PORT,
  EXT2EXT_CLIENT_STREAM_TEXT_PORT,
} from './constants';
import type {
  ExtClientApiRequestMessage,
  ExtClientApiResponseErrorMessage,
  ExtClientApiResponseMessage,
  ExtClientApiResponseSuccessMessage,
  ExtClientBroadcastMessage,
  ExtClientRequestMessage,
  ExtClientResponseMessage,
  ExtClientStreamApiErrorMessage,
  ExtClientStreamChunkMessage,
  ExtClientStreamDoneMessage,
  ExtClientStreamRequestMessage,
  ExtClientStreamTextRequestMessage,
} from './messages';

// Import types from bodhi-browser
import type {
  ApiRequestMessage,
  ApiResponse,
  ApiResponseMessage,
  ExtRequestMessage,
  ExtResponse,
  ExtResponseMessage,
  StreamMessage,
  StreamTextMessage,
} from '@bodhiapp/bodhi-browser-types';
import {
  BODHI_STREAM_PORT,
  BODHI_STREAM_TEXT_PORT,
  EXT_ACTIONS,
  MESSAGE_TYPES,
  isExtError,
  isStreamApiError,
  isStreamChunk,
  isStreamError,
} from '@bodhiapp/bodhi-browser-types';

// Import from core
import {
  AccessRequestBuilder,
  BASE_OAUTH_SCOPE,
  buildAuthorizeUrl,
  buildErrorUrl,
  buildReviewUrl,
  Logger,
  BodhiError,
  createOperationError,
  throwAccessRequestDenialError,
  unwrapResponse,
  refreshAccessToken,
  type AuthState,
  type DiscoveryResult,
  type LoginOptions,
  type LogLevel,
  type RefreshTokenResponse,
  type Tokens,
  type UserInfo,
} from '@bodhiapp/bodhi-js-core';

// ============================================================================
// Local Type Definitions (ext2ext-client specific)
// ============================================================================

export type ClientExtState = 'setup' | 'ready' | 'error';

export interface BodhiExtClientConfig {
  authServerUrl?: string;
  extensionId?: string;
  logLevel?: LogLevel;
  attempts?: number;
  attemptWaitMs?: number;
  attemptTimeout?: number;
}
export { EXT2EXT_CLIENT_ACTIONS, EXT2EXT_CLIENT_MESSAGE_TYPES } from './constants';
export { isExtClientApiError } from './messages';
export type { ExtClientApiError, ExtClientApiResponseMessage } from './messages';

// ============================================================================
// Extension ID Registry and Discovery
// ============================================================================

const DEV_EXTENSION_IDS: string[] = ['ggedphdcbekjlomjaidbajglgihbeaon'];

const PROD_EXTENSION_IDS: string[] = ['bjdjhiombmfbcoeojijpfckljjghmjbf'];

const VITE_ENV_MODE = import.meta.env.MODE || 'development';

// ============================================================================
// BodhiExtClient - ext2ext communication with bodhi-browser-ext
// ============================================================================

export class BodhiExtClient {
  private extensionId?: string;
  private isAuthenticating = false;
  private isExchanging = false;
  private authClientId: string;
  private authServerUrl: string;
  private logger: Logger;
  private state: ClientExtState = 'setup';
  private listenersInitialized = false;
  // Discovery configuration
  // TODO: do not keep as config, instead get them as parameters
  private attempts: number;
  private attemptWaitMs: number;
  private attemptTimeout: number;
  private authEndpoints: {
    authorize: string;
    token: string;
    userinfo: string;
    logout: string;
    revoke: string;
  };
  private refreshPromise: Promise<string | null> | null = null;

  // ============================================================================
  // OAuth Utility Methods (Static)
  // ============================================================================

  private static base64UrlEncode(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return BodhiExtClient.base64UrlEncode(array.buffer);
  }

  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return BodhiExtClient.base64UrlEncode(digest);
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(authClientId: string, config?: BodhiExtClientConfig) {
    this.authClientId = authClientId;
    this.authServerUrl = config?.authServerUrl || 'https://id.getbodhi.app/realms/bodhi';
    this.extensionId = config?.extensionId;
    this.logger = new Logger('BodhiExtClient', config?.logLevel || 'warn');

    // Discovery configuration with defaults
    this.attempts = config?.attempts ?? DISCOVERY_ATTEMPTS;
    this.attemptWaitMs = config?.attemptWaitMs ?? DISCOVERY_ATTEMPT_WAIT_MS;
    this.attemptTimeout = config?.attemptTimeout ?? DISCOVERY_ATTEMPT_TIMEOUT;

    // Construct OAuth endpoints from authServerUrl
    this.authEndpoints = {
      authorize: `${this.authServerUrl}/protocol/openid-connect/auth`,
      token: `${this.authServerUrl}/protocol/openid-connect/token`,
      userinfo: `${this.authServerUrl}/protocol/openid-connect/userinfo`,
      logout: `${this.authServerUrl}/protocol/openid-connect/logout`,
      revoke: `${this.authServerUrl}/protocol/openid-connect/revoke`,
    };

    if (this.extensionId) {
      this.logger.info(`[BodhiExtClient] Created client for extension: ${this.extensionId}`);
    } else {
      this.logger.info(
        `[BodhiExtClient] Created client without extension ID (call init() to discover)`
      );
    }
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current client state
   * @returns 'ready' if extension discovered, 'setup' otherwise
   */
  getState(): ClientExtState {
    return this.state;
  }

  // ============================================================================
  // Extension Discovery (Private Methods)
  // ============================================================================

  /**
   * Get extension IDs for current environment
   */
  private getExtensionIdsForEnvironment(): string[] {
    const isDev = VITE_ENV_MODE !== 'production';
    const ids = isDev ? DEV_EXTENSION_IDS : PROD_EXTENSION_IDS;
    this.logger.info(`[Ext2Ext/Registry] Environment: ${isDev ? 'development' : 'production'}`);
    this.logger.debug('[Ext2Ext/Registry] Using extension IDs:', ids);
    return ids;
  }

  /**
   * Ping extension using bodhi-browser-ext's EXT_REQUEST protocol
   */
  private async pingExtension(extensionId: string): Promise<boolean> {
    this.logger.debug(
      `[Ext2Ext/Discovery] Pinging extension: ${extensionId} with timeout ${this.attemptTimeout}ms`
    );

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.logger.debug(`[Ext2Ext/Discovery] Timeout waiting for extension ${extensionId}`);
        reject(new Error('Timeout'));
      }, this.attemptTimeout);

      try {
        const pingMessage: ExtRequestMessage = {
          type: MESSAGE_TYPES.EXT_REQUEST,
          requestId: crypto.randomUUID(),
          request: {
            action: 'get_extension_id',
          },
        };

        this.logger.debug(`[Ext2Ext/Discovery] Sending message to ${extensionId}:`, pingMessage);

        chrome.runtime.sendMessage(extensionId, pingMessage, (response) => {
          clearTimeout(timer);

          if (chrome.runtime.lastError) {
            this.logger.error(
              `[Ext2Ext/Discovery] Error from extension ${extensionId}:`,
              chrome.runtime.lastError.message
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          this.logger.debug(`[Ext2Ext/Discovery] Response from ${extensionId}:`, response);

          const extResponse = response as ExtResponseMessage;
          if (extResponse && extResponse.type === MESSAGE_TYPES.EXT_RESPONSE) {
            this.logger.debug(`[Ext2Ext/Discovery] ✓ Extension ${extensionId} responded`);
            resolve(true);
          } else {
            this.logger.error(
              `[Ext2Ext/Discovery] Invalid response from ${extensionId}:`,
              response
            );
            reject(new Error('Invalid response'));
          }
        });
      } catch (error) {
        this.logger.error(`[Ext2Ext/Discovery] Exception pinging ${extensionId}:`, error);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Discover Bodhi extension sequentially through known IDs with retry logic
   * @param params Resolved discovery params
   */
  private async discoverBodhiExtension(params: {
    attempts: number;
    attemptWaitMs: number;
    attemptTimeout: number;
  }): Promise<DiscoveryResult> {
    const { attempts, attemptWaitMs: waitMs, attemptTimeout: timeout } = params;

    this.logger.info(
      `[Ext2Ext/Discovery] Starting discovery: ${attempts} attempts per ID, ${timeout}ms timeout, ${waitMs}ms between attempts`
    );

    const extensionIds = this.getExtensionIdsForEnvironment();
    this.logger.debug(
      `[Ext2Ext/Discovery] Will try ${extensionIds.length} extension(s):`,
      extensionIds
    );

    for (const extensionId of extensionIds) {
      // Retry loop for each extension ID
      for (let attempt = 1; attempt <= attempts; attempt++) {
        this.logger.debug(
          `[Ext2Ext/Discovery] Trying ${extensionId} - attempt ${attempt}/${attempts}`
        );

        try {
          await this.pingExtension(extensionId);
          this.logger.info(`[Ext2Ext/Discovery] ✓ Found: ${extensionId} on attempt ${attempt}`);

          return {
            success: true,
            extensionId: extensionId,
          };
        } catch (error) {
          this.logger.debug(
            `[Ext2Ext/Discovery] Attempt ${attempt} failed for ${extensionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );

          // Wait before next attempt (except on last attempt for this ID)
          if (attempt < attempts) {
            await this.sleep(waitMs);
          }
        }
      }

      // All attempts failed for this ID
      this.logger.warn(
        `[Ext2Ext/Discovery] ✗ Not found: ${extensionId} after ${attempts} attempts`
      );
    }

    const triedIds = extensionIds.join(', ');
    const errorMsg = `Extension not found. Tried ${extensionIds.length} IDs with ${attempts} attempts each: ${triedIds}`;
    this.logger.error(`[Ext2Ext/Discovery] ${errorMsg}`);

    return {
      success: false,
      error: errorMsg,
    };
  }

  // ============================================================================
  // Message & Streaming Listeners (Private)
  // ============================================================================

  /**
   * Setup all listeners for UI connections (idempotent)
   */
  private setupListeners(): void {
    // Idempotency check - only setup listeners once
    if (this.listenersInitialized) {
      this.logger.debug('[BodhiExtClient] Listeners already initialized, skipping');
      return;
    }
    this.listenersInitialized = true;

    // Message listener for EXT2EXT_CLIENT_REQUEST and EXT2EXT_CLIENT_API_REQUEST
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (
        message.type !== EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST &&
        message.type !== EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_REQUEST
      ) {
        return false; // Not handled, let other listeners process
      }

      // Guard: check if initialized (allow discoverBodhiExtension even if not ready)
      if (this.state !== 'ready') {
        const isDiscoverAction =
          message.type === EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST &&
          message.request.action === EXT2EXT_CLIENT_ACTIONS.DISCOVER_EXTENSION;

        if (!isDiscoverAction) {
          if (message.type === EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST) {
            sendResponse({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
              requestId: message.requestId,
              response: {
                error: {
                  message: this.createErrorClientNotInitialized(message),
                  type: 'NOT_INITIALIZED',
                },
              },
            } as ExtClientResponseMessage);
          } else {
            sendResponse({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE,
              requestId: message.requestId,
              error: {
                message: `Client not initialized. Extension discovery not complete, cannot handle type:${message.type}, message:${JSON.stringify(message)}`,
                type: 'NOT_INITIALIZED',
              },
            } as ExtClientApiResponseErrorMessage);
          }
          return true;
        }
      }

      this.logger.debug(`[BodhiExtClient] Processing message.type=${message.type}`);

      (async () => {
        const response = await this.handleAction(message);
        sendResponse(response);
      })();

      return true; // Will respond asynchronously
    });

    // Register stream listeners for both parsed (SSE) and raw text protocols
    this.registerStreamPortListener(
      EXT2EXT_CLIENT_STREAM_PORT,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_REQUEST,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_ERROR,
      (port, message) => this.handleStreamRequest(port, message)
    );
    this.registerStreamPortListener(
      EXT2EXT_CLIENT_STREAM_TEXT_PORT,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_REQUEST,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_ERROR,
      (port, message) => this.handleStreamTextRequest(port, message)
    );

    this.logger.info('[BodhiExtClient] Streaming listeners initialized');
  }

  /**
   * Initialize client: setup listeners and discover bodhi-browser-ext
   * @param params Resolved discovery params (already merged with constructor defaults)
   * @throws Error if discovery fails
   */
  async init(params?: {
    attempts?: number;
    attemptWaitMs?: number;
    attemptTimeout?: number;
  }): Promise<void> {
    // Setup listeners first (idempotent)
    this.setupListeners();

    // Skip discovery if already have extensionId
    if (this.extensionId) {
      this.state = 'ready';
      this.logger.warn(
        `[BodhiExtClient] Already initialized with extension ID: ${this.extensionId}`
      );
      return;
    }

    this.logger.info('[BodhiExtClient] Starting discovery');

    // Resolve params with fallback to constructor defaults
    const resolvedParams = {
      attempts: params?.attempts ?? this.attempts,
      attemptWaitMs: params?.attemptWaitMs ?? this.attemptWaitMs,
      attemptTimeout: params?.attemptTimeout ?? this.attemptTimeout,
    };

    const result = await this.discoverBodhiExtension(resolvedParams);

    if (!result.success || !result.extensionId) {
      // State remains 'setup' - discovery action can retry
      throw new Error(result.error || 'Discovery failed');
    }

    this.extensionId = result.extensionId;
    this.state = 'ready';
    this.logger.info(`[BodhiExtClient] ✓ Initialized: ${this.extensionId}`);
  }

  /**
   * Broadcast auth state change to all extension contexts
   * @private
   */
  private broadcastAuthStateChange(): void {
    chrome.runtime
      .sendMessage({
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_BROADCAST,
        event: 'authStateChanged',
      } as ExtClientBroadcastMessage)
      .catch((error) => {
        this.logger.debug('[BodhiExtClient] No listeners for broadcast:', error.message);
      });
  }

  /**
   * Get extension ID from bodhi-browser-ext via EXT_REQUEST
   * @returns Extension ID returned by bodhi-browser-ext
   */
  async getExtensionIdFromExt(): Promise<string> {
    this.logger.debug('[BodhiExtClient] Getting extension ID from bodhi-browser-ext');

    const response = await this.sendExtRequest<{ extension_id: string }>('get_extension_id');

    this.logger.debug('[BodhiExtClient] Extension ID response:', response);
    return response.extension_id;
  }

  /**
   * Handle API request (EXT2EXT_CLIENT_API_REQUEST)
   * Forwards to bodhi-browser-ext via sendApiRequest
   * @param message API request message
   * @returns API response message (success or error)
   */
  private async handleApiRequest<TReq = unknown, TRes = unknown>(
    message: ExtClientApiRequestMessage<TReq>
  ): Promise<ExtClientApiResponseMessage<TRes>> {
    const { requestId } = message;

    this.logger.debug('[BodhiExtClient] Handling API request:', message.request);

    try {
      let requestHeaders = message.request.headers || {};

      if (message.request.authenticated) {
        const accessToken = await this._getAccessTokenRaw();
        if (!accessToken) {
          return {
            type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE,
            requestId,
            error: {
              message: 'Not authenticated. Please log in first.',
              type: 'auth_error',
            },
          } as ExtClientApiResponseErrorMessage;
        }
        requestHeaders = {
          ...requestHeaders,
          Authorization: `Bearer ${accessToken}`,
        };
        this.logger.debug('[BodhiExtClient] Injected auth token for authenticated request');
      }

      const apiResponse = await this.sendApiRequest<TReq, TRes>(
        message.request.method,
        message.request.endpoint,
        message.request.body,
        requestHeaders
      );

      return {
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE,
        requestId,
        response: apiResponse,
      } as ExtClientApiResponseSuccessMessage<TRes>;
    } catch (error) {
      this.logger.error('[BodhiExtClient] API request failed:', error);
      return {
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_RESPONSE,
        requestId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'network_error',
        },
      } as ExtClientApiResponseErrorMessage;
    }
  }

  /**
   * Handle action-based request (EXT2EXT_CLIENT_REQUEST)
   * Routes to ext2ext operations or local OAuth operations
   * @param message Action request message
   * @returns Action response message (success or error)
   */
  private async handleExtClientRequest<TRes = unknown>(
    message: ExtClientRequestMessage
  ): Promise<ExtClientResponseMessage<TRes>> {
    const { requestId, request } = message;
    const { action, params } = request;

    this.logger.debug(`[BodhiExtClient] Handling action: ${action}`);

    try {
      let responseBody: Record<string, unknown> = {};

      switch (action) {
        case EXT2EXT_CLIENT_ACTIONS.DISCOVER_EXTENSION: {
          const receivedParams = params as
            | {
                attempts?: number;
                attemptWaitMs?: number;
                attemptTimeout?: number;
              }
            | undefined;

          await this.init(receivedParams);
          this.logger.info('[BodhiExtClient] Discovery successful:', {
            extensionId: this.extensionId,
            environment: VITE_ENV_MODE,
          });
          responseBody = {
            extensionId: this.extensionId,
            environment: VITE_ENV_MODE,
          };
          break;
        }

        case EXT2EXT_CLIENT_ACTIONS.SET_EXTENSION_ID: {
          const { extensionId } = params as { extensionId: string };
          this.extensionId = extensionId;
          this.state = 'ready';
          this.logger.info('[BodhiExtClient] Extension ID set:', { extensionId });
          responseBody = { success: true };
          break;
        }

        case EXT2EXT_CLIENT_ACTIONS.GET_EXTENSION_ID: {
          const extResponse = await this.sendExtRequestRaw(EXT_ACTIONS.GET_EXTENSION_ID, params);
          if (isExtError(extResponse.response)) {
            return {
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
              requestId,
              response: {
                error: {
                  message:
                    extResponse.response.error.message ||
                    `Extension request failed to get extension ID: ${JSON.stringify(extResponse.response)}`,
                  type: extResponse.response.error.type,
                },
              },
            };
          }
          return {
            type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
            requestId,
            response: extResponse.response as ExtResponse<TRes>,
          };
        }

        case EXT2EXT_CLIENT_ACTIONS.LOGIN: {
          const loginParams = params as LoginOptions | undefined;
          await this.login(loginParams);
          this.broadcastAuthStateChange();
          break;
        }

        case EXT2EXT_CLIENT_ACTIONS.LOGOUT:
          await this.logout();
          this.broadcastAuthStateChange();
          break;

        case EXT2EXT_CLIENT_ACTIONS.GET_AUTH_STATE:
          {
            const authState = await this.getAuthState();
            responseBody = { authState };
          }
          break;

        default:
          return {
            type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
            requestId,
            response: {
              error: { message: `Unknown action: ${action}`, type: 'UNKNOWN_ACTION' },
            },
          };
      }

      return {
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
        requestId,
        response: responseBody as ExtResponse<TRes>,
      };
    } catch (error) {
      this.logger.error('[BodhiExtClient] Unexpected error:', error);
      return {
        type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
        requestId,
        response: {
          error: {
            message:
              error instanceof Error ? error.message : `Unexpected error: ${JSON.stringify(error)}`,
          },
        },
      };
    }
  }

  /**
   * Handle action from either EXT2EXT_CLIENT_REQUEST or EXT2EXT_CLIENT_API_REQUEST
   * Routes to either ext2ext operations, local operations, or API operations
   * Never throws - always returns a valid response message
   * @param message Either ExtClientRequestMessage or ExtClientApiRequestMessage
   * @returns Either ExtClientResponseMessage or ExtClientApiResponseMessage
   */
  // Overload 1: ExtClientRequestMessage → ExtClientResponseMessage
  async handleAction<TRes = unknown>(
    message: ExtClientRequestMessage
  ): Promise<ExtClientResponseMessage<TRes>>;

  // Overload 2: ExtClientApiRequestMessage<TReq> → ExtClientApiResponseMessage<TRes>
  async handleAction<TReq = unknown, TRes = unknown>(
    message: ExtClientApiRequestMessage<TReq>
  ): Promise<ExtClientApiResponseMessage<TRes>>;

  // Implementation signature (must be compatible with all overloads)
  async handleAction<TReq = unknown, TRes = unknown>(
    message: ExtClientRequestMessage | ExtClientApiRequestMessage<TReq>
  ): Promise<ExtClientResponseMessage<TRes> | ExtClientApiResponseMessage<TRes>> {
    switch (message.type) {
      case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_API_REQUEST:
        return this.handleApiRequest<TReq, TRes>(message);

      case EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_REQUEST:
        return this.handleExtClientRequest<TRes>(message);

      default: {
        const { requestId } = message;

        this.logger.error('[BodhiExtClient] Unknown message type:', (message as any).type);
        return {
          type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_RESPONSE,
          requestId,
          response: {
            error: {
              message: `Unknown message type: ${(message as any).type}`,
              type: 'UNKNOWN_MESSAGE_TYPE',
            },
          },
        } as ExtClientResponseMessage<TRes>;
      }
    }
  }

  // ============================================================================
  // OAuth Public Methods
  // ============================================================================

  /**
   * Login user via access-request + OAuth2 + PKCE flow
   * @param options - Optional login options
   * @throws Error if login fails
   */
  async login(options?: LoginOptions): Promise<void> {
    // Prevent concurrent login attempts
    if (this.isAuthenticating) {
      return;
    }

    // Skip if already logged in (unless exchanging to widen grants)
    const authState = await this.getAuthState();
    if (authState.status === 'authenticated' && !options?.exchange) {
      return;
    }

    this.isAuthenticating = true;
    this.isExchanging = options?.exchange ?? false;

    try {
      // Extension must be discovered before login
      if (!this.extensionId) {
        throw new Error('Extension not discovered. Please detect Bodhi extension before login.');
      }

      const userRole = options?.userRole ?? 'scope_user_user';
      const redirectUri = chrome.identity.getRedirectURL('callback');

      const codeVerifier = BodhiExtClient.generateCodeVerifier();
      const codeChallenge = await BodhiExtClient.generateCodeChallenge(codeVerifier);
      const state = BodhiExtClient.generateCodeVerifier();
      await chrome.storage.session.set({ codeVerifier, state, authInProgress: true });

      const authUrl = buildAuthorizeUrl(this.authEndpoints, {
        clientId: this.authClientId,
        redirectUri,
        scope: BASE_OAUTH_SCOPE,
        state,
        codeChallenge,
      });
      const errorUrl = buildErrorUrl(redirectUri);

      const builder = new AccessRequestBuilder(this.authClientId).requestedRole(userRole);
      if (options?.requested) builder.requested(options.requested);
      if (options?.exchange) builder.exchange(true);
      const accessRequestResult = await this.requestAccess(builder.build());
      const { review_url: reviewUrl } = unwrapResponse(accessRequestResult);
      const target = buildReviewUrl(reviewUrl, authUrl, errorUrl);

      const redirectUrl = await this.launchReview(target);
      await this.completeOAuthRedirect(redirectUrl);
    } finally {
      this.isAuthenticating = false;
      this.isExchanging = false;
    }
  }

  /**
   * Exchange authorization code for tokens (private helper for login)
   * @param code Authorization code from OAuth callback
   */
  private async exchangeCodeForTokens(code: string): Promise<void> {
    // Additional safety: skip if already logged in — unless an exchange is in flight,
    // where the point is to replace the current tokens with newly-granted ones.
    const authState = await this.getAuthState();
    if (authState.status === 'authenticated' && !this.isExchanging) {
      return;
    }

    const { codeVerifier } = await chrome.storage.session.get('codeVerifier');
    const redirectUri = chrome.identity.getRedirectURL('callback');

    const response = await fetch(this.authEndpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.authClientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();

    await this.storeTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
    });
  }

  /**
   * Get current authentication state
   * @returns AuthState (discriminated union: AuthLoggedIn | AuthLoggedOut)
   */
  async getAuthState(): Promise<AuthState> {
    const accessToken = await this._getAccessTokenRaw();

    if (!accessToken) {
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    }

    try {
      const claims = this.parseJwt(accessToken) as Record<string, unknown>;
      const userInfo: UserInfo = {
        sub: claims.sub as string,
        email: claims.email as string,
        name: claims.name as string,
        given_name: claims.given_name as string,
        family_name: claims.family_name as string,
        preferred_username: claims.preferred_username as string,
      };

      return {
        status: 'authenticated',
        user: userInfo,
        accessToken,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    } catch (error) {
      this.logger.error('Failed to parse token:', error);
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
        refreshToken: null,
        expiresAt: null,
        isTokenRefresh: false,
      };
    }
  }

  /**
   * Logout current user and revoke tokens
   */
  async logout(): Promise<void> {
    const { refreshToken } = await chrome.storage.session.get('refreshToken');

    if (refreshToken) {
      try {
        await fetch(this.authEndpoints.revoke, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: refreshToken,
            client_id: this.authClientId,
            token_type_hint: 'refresh_token',
          }),
        });
      } catch (error) {
        this.logger.warn('[OAuth] Token revocation failed:', error);
      }
    }

    await this.clearTokens();
  }

  // ============================================================================
  // ============================================================================
  // Access Request Methods
  // ============================================================================

  async requestAccess(
    body: CreateAccessRequest
  ): Promise<ApiResponse<CreateAccessRequestResponse>> {
    // authenticated=true safely attaches the token when one exists (exchange needs it).
    return this.sendApiRequest<CreateAccessRequest, CreateAccessRequestResponse>(
      'POST',
      '/bodhi/v1/apps/request-access',
      body,
      undefined,
      true
    );
  }

  private launchReview(target: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: target, interactive: true }, async (redirectUrl) => {
        await chrome.storage.session.set({ authInProgress: false });
        if (chrome.runtime.lastError) {
          await chrome.storage.session.remove(['codeVerifier', 'state']);
          reject(chrome.runtime.lastError);
          return;
        }
        if (!redirectUrl) {
          await chrome.storage.session.remove(['codeVerifier', 'state']);
          reject(createOperationError('oauth_error', 'No redirect URL received'));
          return;
        }
        resolve(redirectUrl);
      });
    });
  }

  private async completeOAuthRedirect(redirectUrl: string): Promise<void> {
    const url = new URL(redirectUrl);
    const error = url.searchParams.get('error');
    if (error) {
      await chrome.storage.session.remove(['codeVerifier', 'state']);
      if (url.searchParams.get('error_source') === 'bodhi') {
        throwAccessRequestDenialError(error === 'access_denied' ? 'denied' : error);
      }
      throw createOperationError('oauth_error', url.searchParams.get('error_description') ?? error);
    }

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const { state: savedState } = await chrome.storage.session.get('state');
    if (!returnedState || returnedState !== savedState) {
      await chrome.storage.session.remove(['codeVerifier', 'state']);
      throw createOperationError('oauth_error', 'State mismatch');
    }
    if (!code) {
      await chrome.storage.session.remove(['codeVerifier', 'state']);
      throw createOperationError('oauth_error', 'No authorization code');
    }

    await this.exchangeCodeForTokens(code);
    await chrome.storage.session.remove(['codeVerifier', 'state']);
    const authStateResult = await this.getAuthState();
    if (authStateResult.status !== 'authenticated') {
      throw createOperationError('oauth_error', 'Login failed');
    }
  }

  // Ext2Ext Communication (Private Methods)
  // ============================================================================

  /**
   * Send EXT_REQUEST message to bodhi-browser-ext
   * @param action The action to perform
   * @param params Optional parameters
   * @returns Response body (unwrapped, throws on error)
   */
  private async sendExtRequest<T>(
    action: string,

    params?: any
  ): Promise<T> {
    const response = await this.sendExtRequestRaw(action, params);

    // Check success/error discriminated union (flattened: T | { error: ExtError })
    if (isExtError(response.response)) {
      this.logger.error('[BodhiExtClient] Extension error:', response.response.error);
      throw new Error(
        response.response.error.message ||
          `Extension request failed: ${JSON.stringify(response.response)}`
      );
    }

    // Flattened: response.response is the data directly
    return response.response as T;
  }

  /**
   * Send API_REQUEST message to bodhi-browser-ext for HTTP operations
   * @param method HTTP method (GET, POST, etc.)
   * @param endpoint API endpoint path
   * @param body Optional request body
   * @param headers Optional headers
   * @param authenticated Attach the current token when one exists (safe: skipped if none)
   * @returns API response from LLM server via bodhi-browser-ext
   */
  private async sendApiRequest<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated = false
  ): Promise<ApiResponse<TRes>> {
    if (!this.extensionId) {
      throw new BodhiError(
        'not_initialized',
        this.createErrorClientNotInitialized({ type: 'api', method, endpoint })
      );
    }

    this.logger.debug(
      `[BodhiExtClient] Sending API_REQUEST: method=${method}, endpoint=${endpoint}`,
      body ? { body } : ''
    );

    let requestHeaders = headers;
    if (authenticated) {
      const token = await this._getAccessTokenRaw();
      if (token) requestHeaders = { ...headers, Authorization: `Bearer ${token}` };
    }

    const requestId = crypto.randomUUID();
    const message: ApiRequestMessage<TReq> = {
      type: MESSAGE_TYPES.API_REQUEST,
      requestId,
      request: {
        method,
        endpoint,
        body,
        headers: requestHeaders,
      },
    };

    this.logger.debug(`[BodhiExtClient] Request ID: ${requestId}, Extension: ${this.extensionId}`);

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(this.extensionId, message, (response: ApiResponseMessage) => {
          if (chrome.runtime.lastError) {
            this.logger.error(
              `[BodhiExtClient] Chrome runtime error for request ${requestId}:`,
              chrome.runtime.lastError
            );
            reject(
              new BodhiError(
                'extension_error',
                chrome.runtime.lastError.message ?? 'Chrome runtime error'
              )
            );
            return;
          }

          this.logger.debug(`[BodhiExtClient] Response for request ${requestId}:`, response);

          if (!response) {
            this.logger.error(`[BodhiExtClient] No response received for request ${requestId}`);
            reject(new BodhiError('extension_error', 'No response from extension'));
            return;
          }

          if (response.type === MESSAGE_TYPES.API_RESPONSE && response.requestId === requestId) {
            if ('error' in response) {
              this.logger.error(`[BodhiExtClient] API error for ${requestId}:`, response.error);
              reject(
                new BodhiError(response.error.type || 'extension_error', response.error.message)
              );
            } else {
              this.logger.debug(`[BodhiExtClient] ✓ Valid API_RESPONSE for ${requestId}`);
              resolve(response.response as ApiResponse<TRes>);
            }
          } else {
            this.logger.error(
              `[BodhiExtClient] Invalid response format for ${requestId}:`,
              response
            );
            reject(new BodhiError('extension_error', 'Invalid response format'));
          }
        });
      } catch (error) {
        this.logger.error(`[BodhiExtClient] Exception sending message for ${requestId}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Send EXT_REQUEST message to bodhi-browser-ext and return full response
   * @param action The action to perform
   * @param params Optional parameters
   * @returns Full ExtResponseMessage from bodhi-browser-ext
   */
  private async sendExtRequestRaw<TParams = void>(
    action: string,
    params?: TParams
  ): Promise<ExtResponseMessage> {
    if (!this.extensionId) {
      throw new BodhiError(
        'not_initialized',
        this.createErrorClientNotInitialized({ type: 'ext', action, params })
      );
    }

    this.logger.debug(
      `[BodhiExtClient] Sending EXT_REQUEST (raw): action=${action}`,
      params ? { params } : ''
    );

    const requestId = crypto.randomUUID();
    const message: ExtRequestMessage = {
      type: MESSAGE_TYPES.EXT_REQUEST,
      requestId,
      request: {
        action,
        params,
      },
    };

    this.logger.debug(`[BodhiExtClient] Request ID: ${requestId}, Extension: ${this.extensionId}`);

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(this.extensionId, message, (response: ExtResponseMessage) => {
          if (chrome.runtime.lastError) {
            this.logger.error(
              `[BodhiExtClient] Chrome runtime error for request ${requestId}:`,
              chrome.runtime.lastError
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          this.logger.debug(`[BodhiExtClient] Response for request ${requestId}:`, response);

          if (!response) {
            this.logger.error(`[BodhiExtClient] No response received for request ${requestId}`);
            reject(new Error('No response from extension'));
            return;
          }

          if (response.type === MESSAGE_TYPES.EXT_RESPONSE && response.requestId === requestId) {
            this.logger.debug(`[BodhiExtClient] ✓ Valid EXT_RESPONSE for ${requestId}`);
            resolve(response);
          } else {
            this.logger.error(
              `[BodhiExtClient] Invalid response format for ${requestId}:`,
              response
            );
            reject(new BodhiError('extension_error', 'Invalid response format'));
          }
        });
      } catch (error) {
        this.logger.error(`[BodhiExtClient] Exception sending message for ${requestId}:`, error);
        reject(error);
      }
    });
  }

  // ============================================================================
  // Streaming Methods (ext2ext streaming via chrome.runtime.connect)
  // ============================================================================

  /**
   * Active streaming ports for cleanup
   */
  private activeStreamPorts = new Map<string, chrome.runtime.Port>();

  /**
   * Streaming timeout in milliseconds (60 seconds, matches bodhi-browser-ext)
   */
  private static readonly STREAM_TIMEOUT = 60000;

  /**
   * Register a chrome.runtime.onConnect listener for a streaming port.
   * Validates port name and message type, then delegates to handler.
   */
  private registerStreamPortListener(
    portName: string,
    expectedMessageType: string,
    errorMessageType: string,
    handler: (port: chrome.runtime.Port, message: any) => Promise<void>
  ): void {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== portName) return;

      this.logger.info(`[BodhiExtClient] Port connected: ${portName}`);

      port.onMessage.addListener(async (message: any) => {
        if (message.type !== expectedMessageType) {
          this.logger.warn(`[BodhiExtClient] Unknown message type on ${portName}:`, message.type);
          port.postMessage({
            type: errorMessageType,
            requestId: message.requestId,
            error: { message: 'Unknown message type', type: 'extension_error' },
          });
          return;
        }
        await handler(port, message);
      });

      port.onDisconnect.addListener(() => {
        this.logger.info(`[BodhiExtClient] Port disconnected: ${portName}`);
      });
    });
  }

  /**
   * Generic stream relay: validates auth, connects to bodhi-browser-ext,
   * sets up timeout/disconnect handling, and delegates message forwarding
   * to the onBodhiMessage callback.
   *
   * @param onBodhiMessage Called for each message from bodhi-browser-ext.
   *   Returns true if the stream is complete (triggers cleanup).
   */
  private async handleGenericStreamRelay(
    uiPort: chrome.runtime.Port,
    requestId: string,
    request: {
      method: string;
      endpoint: string;
      body?: unknown;
      headers?: Record<string, string>;
      authenticated?: boolean;
    },
    bodhiPortName: string,
    bodhiRequestType: string,
    errorMessageType: string,
    onBodhiMessage: (streamMessage: any, uiPort: chrome.runtime.Port, requestId: string) => boolean
  ): Promise<void> {
    this.logger.debug('[BodhiExtClient] Processing stream relay:', {
      requestId,
      method: request.method,
      endpoint: request.endpoint,
      bodhiPortName,
    });

    if (!this.extensionId) {
      uiPort.postMessage({
        type: errorMessageType,
        requestId,
        error: { message: `Client not initialized (no extensionId)`, type: 'extension_error' },
      });
      return;
    }

    try {
      let requestHeaders: Record<string, string> = { ...request.headers };

      if (request.authenticated !== false) {
        const accessToken = await this._getAccessTokenRaw();
        if (!accessToken) {
          uiPort.postMessage({
            type: errorMessageType,
            requestId,
            error: { message: 'Not authenticated. Please log in first.', type: 'extension_error' },
          });
          return;
        }
        requestHeaders = { ...requestHeaders, Authorization: `Bearer ${accessToken}` };
        this.logger.debug('[BodhiExtClient] Injected auth token for stream relay');
      }

      const bodhiPort = chrome.runtime.connect(this.extensionId!, { name: bodhiPortName });
      this.activeStreamPorts.set(requestId, bodhiPort);

      const timeoutId = setTimeout(() => {
        if (this.activeStreamPorts.has(requestId)) {
          this.logger.error(`[BodhiExtClient] Stream timeout for ${requestId}`);
          uiPort.postMessage({
            type: errorMessageType,
            requestId,
            error: { message: 'Stream request timed out', type: 'timeout_error' },
          });
          this.cleanupStreamPort(requestId);
        }
      }, BodhiExtClient.STREAM_TIMEOUT);

      bodhiPort.onMessage.addListener((streamMessage: any) => {
        const done = onBodhiMessage(streamMessage, uiPort, requestId);
        if (done) {
          clearTimeout(timeoutId);
          this.cleanupStreamPort(requestId);
        }
      });

      bodhiPort.onDisconnect.addListener(() => {
        clearTimeout(timeoutId);
        if (this.activeStreamPorts.has(requestId)) {
          this.logger.error(`[BodhiExtClient] Bodhi port disconnected for ${requestId}`);
          uiPort.postMessage({
            type: errorMessageType,
            requestId,
            error: {
              message: 'Connection to Bodhi extension closed unexpectedly',
              type: 'network_error',
            },
          });
          this.activeStreamPorts.delete(requestId);
        }
      });

      const bodhiRequest: ApiRequestMessage = {
        type: bodhiRequestType,
        requestId,
        request: {
          method: request.method,
          endpoint: request.endpoint,
          body: request.body,
          headers: requestHeaders,
        },
      };
      this.logger.debug('[BodhiExtClient] Sending stream request to bodhi port:', bodhiRequest);
      bodhiPort.postMessage(bodhiRequest);
    } catch (error) {
      const err = error as Error;
      this.logger.error('[BodhiExtClient] Stream relay error:', JSON.stringify(err.message));
      uiPort.postMessage({
        type: errorMessageType,
        requestId,
        error: {
          message: `uncaught error: ${JSON.stringify({ error: err, message: err.message })}`,
          type: 'extension_error',
        },
      });
    }
  }

  /**
   * Clean up a streaming port connection
   */
  private cleanupStreamPort(requestId: string): void {
    const port = this.activeStreamPorts.get(requestId);
    if (port) {
      try {
        port.disconnect();
      } catch {
        // Port may already be disconnected
      }
      this.activeStreamPorts.delete(requestId);
    }
  }

  /**
   * Handle SSE-parsed streaming request — translates STREAM_* messages to EXT2EXT_CLIENT_STREAM_*
   */
  private async handleStreamRequest(
    uiPort: chrome.runtime.Port,
    message: ExtClientStreamRequestMessage
  ): Promise<void> {
    const { requestId, request } = message;
    await this.handleGenericStreamRelay(
      uiPort,
      requestId,
      request,
      BODHI_STREAM_PORT,
      MESSAGE_TYPES.STREAM_REQUEST,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_ERROR,
      (streamMessage: StreamMessage, uiPort, requestId) => {
        if (isStreamChunk(streamMessage)) {
          const response = streamMessage.response;
          const responseBody = response.body as { done?: boolean } | undefined;

          if (response.status >= 400) {
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_API_ERROR,
              requestId,
              response: response as ApiResponse<BodhiErrorResponse>,
            } satisfies ExtClientStreamApiErrorMessage);
            return false;
          } else if (responseBody?.done) {
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_DONE,
              requestId,
            } satisfies ExtClientStreamDoneMessage);
            this.logger.info(`[BodhiExtClient] Stream complete for ${requestId}`);
            return true;
          } else {
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_CHUNK,
              requestId,
              response,
            } satisfies ExtClientStreamChunkMessage);
            return false;
          }
        } else if (isStreamApiError(streamMessage)) {
          this.logger.error(
            `[BodhiExtClient] Stream API error for ${requestId}: ${streamMessage.response.status}`
          );
          uiPort.postMessage({
            type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_API_ERROR,
            requestId,
            response: streamMessage.response as ApiResponse<BodhiErrorResponse>,
          } satisfies ExtClientStreamApiErrorMessage);
          return false;
        } else if (isStreamError(streamMessage)) {
          this.logger.error(
            `[BodhiExtClient] Stream error for ${requestId}:`,
            streamMessage.error.message
          );
          uiPort.postMessage({
            type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_ERROR,
            requestId,
            error: {
              message: `stream error: ${JSON.stringify(streamMessage)}`,
              type: 'extension_error',
            },
          });
          return true;
        }
        return false;
      }
    );
  }

  /**
   * Handle raw text streaming request — translates STREAM_TEXT_* messages to EXT2EXT_CLIENT_STREAM_TEXT_*
   */
  private async handleStreamTextRequest(
    uiPort: chrome.runtime.Port,
    message: ExtClientStreamTextRequestMessage
  ): Promise<void> {
    const { requestId, request } = message;
    await this.handleGenericStreamRelay(
      uiPort,
      requestId,
      request,
      BODHI_STREAM_TEXT_PORT,
      MESSAGE_TYPES.STREAM_TEXT_REQUEST,
      EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_ERROR,
      (streamMessage: StreamTextMessage, uiPort, requestId) => {
        switch (streamMessage.type) {
          case MESSAGE_TYPES.STREAM_TEXT_START:
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_START,
              requestId,
              status: streamMessage.status,
              headers: streamMessage.headers,
            });
            return false;
          case MESSAGE_TYPES.STREAM_TEXT_CHUNK:
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_CHUNK,
              requestId,
              chunk: streamMessage.chunk,
            });
            return false;
          case MESSAGE_TYPES.STREAM_TEXT_DONE:
            this.logger.info(`[BodhiExtClient] Stream text complete for ${requestId}`);
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_DONE,
              requestId,
            });
            return true;
          case MESSAGE_TYPES.STREAM_TEXT_ERROR:
            this.logger.error(
              `[BodhiExtClient] Stream text error for ${requestId}:`,
              streamMessage.error.message
            );
            uiPort.postMessage({
              type: EXT2EXT_CLIENT_MESSAGE_TYPES.EXT2EXT_CLIENT_STREAM_TEXT_ERROR,
              requestId,
              error: streamMessage.error,
            });
            return true;
        }
        return false;
      }
    );
  }

  // ============================================================================
  // Token Management (Private Methods)
  // ============================================================================

  private async storeTokens(tokens: Tokens): Promise<void> {
    const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;

    await chrome.storage.session.set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresAt,
    });
  }

  protected async _getAccessTokenRaw(): Promise<string | null> {
    const { accessToken, expiresAt } = await chrome.storage.session.get([
      'accessToken',
      'expiresAt',
    ]);

    if (!accessToken || !expiresAt) {
      return null;
    }

    if (Date.now() >= expiresAt - 5 * 1000) {
      // Token expired - try to refresh
      const { refreshToken } = await chrome.storage.session.get('refreshToken');
      if (refreshToken) {
        return this._tryRefreshToken(refreshToken);
      }
      return null;
    }

    return accessToken;
  }

  /**
   * Try to refresh access token using refresh token
   * Race condition prevention: Returns existing promise if refresh already in progress
   */
  private async _tryRefreshToken(refreshToken: string): Promise<string | null> {
    // If already refreshing, return the existing promise (avoids duplicate requests)
    if (this.refreshPromise) {
      this.logger.debug('Refresh already in progress, returning existing promise');
      return this.refreshPromise;
    }

    // Start refresh and store promise
    this.refreshPromise = this._doRefreshToken(refreshToken);

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async _doRefreshToken(refreshToken: string): Promise<string | null> {
    this.logger.debug('Refreshing access token');

    try {
      const result = await refreshAccessToken(
        this.authEndpoints.token,
        refreshToken,
        this.authClientId
      );

      if (result.success) {
        await this._storeRefreshedTokens(result.tokens);
        this.logger.info('Token refreshed successfully');
        this.broadcastAuthStateChange();
        return result.tokens.access_token;
      }

      if (result.error === 'invalid_grant') {
        this.logger.warn('Refresh token expired or revoked, clearing tokens and logging out');
        await this.clearTokens();
        this.broadcastAuthStateChange();
        return null;
      }
    } catch (error) {
      this.logger.warn('Token refresh failed:', error);
    }

    // Refresh failed (temp issue) - throw error (don't clear tokens)
    this.logger.warn('Token refresh failed, keeping tokens for manual retry');
    throw createOperationError(
      'auth_error',
      'Access token expired and unable to refresh. Try logging out and logging in again.'
    );
  }

  /**
   * Store refreshed tokens
   */
  private async _storeRefreshedTokens(tokens: RefreshTokenResponse): Promise<void> {
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    const storageData: Record<string, string | number> = {
      accessToken: tokens.access_token,
      expiresAt,
    };

    // Update refresh token if provided (Keycloak token rotation)
    if (tokens.refresh_token) {
      storageData.refreshToken = tokens.refresh_token;
    }

    if (tokens.id_token) {
      storageData.idToken = tokens.id_token;
    }

    await chrome.storage.session.set(storageData);
  }

  private async clearTokens(): Promise<void> {
    // Clear OAuth tokens
    await chrome.storage.session.remove([
      'accessToken',
      'refreshToken',
      'idToken',
      'expiresAt',
      'codeVerifier',
      'state',
      'authInProgress',
      'bodhiUserInfo',
    ]);
  }

  private parseJwt(token: string): Record<string, unknown> {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  private createErrorClientNotInitialized(message: unknown) {
    return `Client not initialized. Extension discovery not triggered nor extensionId set, cannot handle request: ${JSON.stringify(message)}`;
  }
}
