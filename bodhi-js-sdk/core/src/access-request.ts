import type {
  CreateAccessRequest,
  RequestedMcpServer,
  RequestedResourcesV1,
  UserScope,
} from '@bodhiapp/ts-client';
import type { LoginOptions, LoginProgressCallback } from './types';

export class AccessRequestBuilder {
  private body: Partial<Omit<CreateAccessRequest, 'requested'>> & {
    requested?: RequestedResourcesV1;
  } = {};

  constructor(appClientId: string) {
    this.body.app_client_id = appClientId;
  }

  requestedRole(role: UserScope): this {
    this.body.requested_role = role;
    return this;
  }

  requested(resources: RequestedResourcesV1): this {
    this.body.requested = resources;
    return this;
  }

  modelsAccess(show = true): this {
    this.ensureRequested().models_access = show;
    return this;
  }

  modelsList(show = true): this {
    this.ensureRequested().models_list = show;
    return this;
  }

  mcpsAccess(show = true): this {
    this.ensureRequested().mcps_access = show;
    return this;
  }

  mcpsList(show = true): this {
    this.ensureRequested().mcps_list = show;
    return this;
  }

  addMcpServer(url: string): this {
    const requested = this.ensureRequested();
    if (!requested.mcp_servers) requested.mcp_servers = [];
    requested.mcp_servers.push({ url } as RequestedMcpServer);
    return this;
  }

  private ensureRequested(): RequestedResourcesV1 {
    if (!this.body.requested) this.body.requested = {};
    return this.body.requested;
  }

  build(): CreateAccessRequest {
    if (!this.body.app_client_id) throw new Error('app_client_id is required');
    if (!this.body.requested_role) throw new Error('requested_role is required');
    const { requested, ...rest } = this.body;
    return {
      ...rest,
      requested: { version: '1' as const, ...requested },
    } as CreateAccessRequest;
  }
}

export class LoginOptionsBuilder {
  private options: LoginOptions = {};
  private requested: RequestedResourcesV1 = {};

  setRole(role: UserScope): this {
    this.options.userRole = role;
    return this;
  }

  setModelsAccess(show = true): this {
    this.requested.models_access = show;
    return this;
  }

  setModelsList(show = true): this {
    this.requested.models_list = show;
    return this;
  }

  setMcpsAccess(show = true): this {
    this.requested.mcps_access = show;
    return this;
  }

  setMcpsList(show = true): this {
    this.requested.mcps_list = show;
    return this;
  }

  addMcpServer(url: string): this {
    if (!this.requested.mcp_servers) this.requested.mcp_servers = [];
    this.requested.mcp_servers.push({ url } as RequestedMcpServer);
    return this;
  }

  setRequested(resources: RequestedResourcesV1): this {
    this.requested = resources;
    return this;
  }

  setOnProgress(callback: LoginProgressCallback): this {
    this.options.onProgress = callback;
    return this;
  }

  setReauthorize(reauthorize = true): this {
    this.options.reauthorize = reauthorize;
    return this;
  }

  build(): LoginOptions {
    const result = { ...this.options };
    if (Object.keys(this.requested).length > 0) {
      result.requested = { ...this.requested };
    }
    return result;
  }
}
