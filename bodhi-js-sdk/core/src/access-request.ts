import type {
  AccessRequestStatusResponse,
  CreateAccessRequest,
  FlowType,
  RequestedMcpServer,
  RequestedResources,
  ToolsetTypeRequest,
  UserScope,
} from '@bodhiapp/ts-client';
import { createOperationError } from './errors';
import { isApiResultOperationError, isApiResultSuccess, type ApiResponseResult } from './types/api';

export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_POLL_TIMEOUT_MS = 300_000;

/**
 * Shared polling logic for access request status.
 * Polls until approved, denied, failed, or expired.
 *
 * @param getStatusFn - Function that fetches the current status
 * @param requestId - The access request ID to poll
 * @param options - Polling interval and timeout configuration
 * @returns The approved AccessRequestStatusResponse
 * @throws OperationError on denial, failure, expiry, timeout, or fetch error
 */
export function pollAccessRequestUntilResolved(
  getStatusFn: (requestId: string) => Promise<ApiResponseResult<AccessRequestStatusResponse>>,
  requestId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<AccessRequestStatusResponse> {
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() - startTime >= timeoutMs) {
        reject(new Error('Access request polling timed out'));
        return;
      }

      const result = await getStatusFn(requestId);
      if (isApiResultOperationError(result)) {
        reject(createOperationError(result.error.message, result.error.type));
        return;
      }
      if (!isApiResultSuccess(result)) {
        reject(createOperationError(`Unexpected HTTP ${result.status}`, 'auth_error'));
        return;
      }

      const status = result.body.status;
      if (status === 'approved') {
        resolve(result.body);
        return;
      }
      if (status === 'denied' || status === 'failed' || status === 'expired') {
        reject(createOperationError(`Access request ${status}`, 'auth_error'));
        return;
      }

      // Still draft/pending - continue polling
      setTimeout(check, intervalMs);
    };

    check();
  });
}

export class AccessRequestBuilder {
  private body: Partial<CreateAccessRequest> = {};

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

  requested(resources: RequestedResources): this {
    this.body.requested = resources;
    return this;
  }

  addToolsetType(toolsetType: string): this {
    if (!this.body.requested) this.body.requested = {};
    if (!this.body.requested.toolset_types) this.body.requested.toolset_types = [];
    this.body.requested.toolset_types.push({ toolset_type: toolsetType } as ToolsetTypeRequest);
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
    return this.body as CreateAccessRequest;
  }
}
