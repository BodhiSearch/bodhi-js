import type {
  AccessRequestStatusResponse,
  CreateAccessRequest,
  FlowType,
  RequestedMcpServer,
  RequestedResourcesV1,
  UserScope,
} from '@bodhiapp/ts-client';
import type { ApiResponse } from '@bodhiapp/bodhi-browser-types';
import { BodhiError, unwrapResponse } from '@bodhiapp/bodhi-browser-types';
import { createOperationError, throwAccessRequestDenialError } from './errors';
import type { LoginOptions, LoginProgressCallback } from './types';

export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_POLL_TIMEOUT_MS = 300_000;

/**
 * Shared polling logic for access request status.
 * Polls until approved, denied, failed, or expired.
 *
 * @param getStatusFn - Function that fetches the current status (throws BodhiError on operational errors)
 * @param requestId - The access request ID to poll
 * @param options - Polling interval and timeout configuration
 * @returns The approved AccessRequestStatusResponse
 * @throws BodhiError on denial, failure, expiry, timeout, or fetch error
 */
export function pollAccessRequestUntilResolved(
  getStatusFn: (requestId: string) => Promise<ApiResponse<AccessRequestStatusResponse>>,
  requestId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<AccessRequestStatusResponse> {
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() - startTime >= timeoutMs) {
        reject(createOperationError('timeout_error', 'Access request polling timed out'));
        return;
      }

      try {
        const result = await getStatusFn(requestId);
        const body = unwrapResponse(result);
        const status = body.status;
        if (status === 'approved') {
          resolve(body);
          return;
        }
        if (status === 'denied' || status === 'expired' || status === 'failed') {
          throwAccessRequestDenialError(status);
        }

        // Still draft/pending - continue polling
        setTimeout(check, intervalMs);
      } catch (error) {
        // BodhiError from getStatusFn (network, timeout, etc.) - reject immediately
        if (error instanceof BodhiError) {
          reject(error);
          return;
        }
        reject(error);
      }
    };

    check();
  });
}

export class AccessRequestBuilder {
  private body: Partial<Omit<CreateAccessRequest, 'requested'>> & {
    requested?: RequestedResourcesV1;
  } = {};

  constructor(appClientId: string) {
    this.body.app_client_id = appClientId;
  }

  flowType(type: FlowType): this {
    this.body.flow_type = type;
    return this;
  }

  redirectUrl(url: string): this {
    this.body.redirect_url = url;
    return this;
  }

  requestedRole(role: UserScope): this {
    this.body.requested_role = role;
    return this;
  }

  requested(resources: RequestedResourcesV1): this {
    this.body.requested = resources;
    return this;
  }

  addMcpServer(url: string): this {
    if (!this.body.requested) this.body.requested = {};
    if (!this.body.requested.mcp_servers) this.body.requested.mcp_servers = [];
    this.body.requested.mcp_servers.push({ url } as RequestedMcpServer);
    return this;
  }

  build(): CreateAccessRequest {
    if (!this.body.app_client_id) throw new Error('app_client_id is required');
    if (!this.body.flow_type) throw new Error('flow_type is required');
    if (!this.body.requested_role) throw new Error('requested_role is required');
    const { requested, ...rest } = this.body;
    const result = {
      ...rest,
      requested: { version: '1' as const, ...requested },
    } as CreateAccessRequest;
    if (result.flow_type === 'redirect' && result.redirect_url) {
      const sep = result.redirect_url.includes('?') ? '&' : '?';
      result.redirect_url = `${result.redirect_url}${sep}bodhi_flow=access_request`;
    }
    return result;
  }
}

export class LoginOptionsBuilder {
  private options: LoginOptions = {};
  private mcpServers: Array<{ url: string }> = [];

  setRole(role: UserScope): this {
    this.options.userRole = role;
    return this;
  }

  addMcpServer(url: string): this {
    this.mcpServers.push({ url });
    return this;
  }

  setFlowType(type: FlowType): this {
    this.options.flowType = type;
    return this;
  }

  setRedirectUrl(url: string): this {
    this.options.redirectUrl = url;
    return this;
  }

  setOnProgress(callback: LoginProgressCallback): this {
    this.options.onProgress = callback;
    return this;
  }

  setPollInterval(ms: number): this {
    this.options.pollIntervalMs = ms;
    return this;
  }

  setPollTimeout(ms: number): this {
    this.options.pollTimeoutMs = ms;
    return this;
  }

  build(): LoginOptions {
    const result = { ...this.options };
    if (this.mcpServers.length > 0) {
      result.requested = { mcp_servers: [...this.mcpServers] };
    }
    return result;
  }
}
