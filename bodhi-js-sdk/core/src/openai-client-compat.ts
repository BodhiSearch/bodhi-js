/**
 * OpenAI-compatible client resources
 *
 * Provides OpenAI SDK-style namespaced API for Bodhi Browser clients:
 * - client.chat.completions.create()
 * - client.models.list()
 * - client.embeddings.create()
 */

import type {
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
  CreateChatCompletionStreamResponse,
  CreateEmbeddingRequest,
  CreateEmbeddingResponse,
  Model,
  ListModelsResponse,
  ListToolsetsResponse,
  ListMcpsResponse,
  McpToolsResponse,
} from '@bodhiapp/ts-client';
import type { ApiResponse } from '@bodhiapp/bodhi-browser-types';
import { unwrapResponse } from '@bodhiapp/bodhi-browser-types';

/**
 * Minimal client interface required by resource classes
 */
export interface ResourceClient {
  sendApiRequest<TReq = void, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<ApiResponse<TRes>>;

  stream<TReq = unknown, TRes = unknown>(
    method: string,
    endpoint: string,
    body?: TReq,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): AsyncGenerator<TRes>;
}

/**
 * Base class for API resources
 */
export abstract class APIResource {
  protected client: ResourceClient;

  constructor(client: ResourceClient) {
    this.client = client;
  }
}

/**
 * Chat completions resource
 */
export class Completions extends APIResource {
  /**
   * Create a chat completion
   * Returns response directly if stream: false
   * Returns AsyncGenerator if stream: true
   */
  create(
    body: CreateChatCompletionRequest & { stream?: false }
  ): Promise<CreateChatCompletionResponse>;

  create(
    body: CreateChatCompletionRequest & { stream: true }
  ): AsyncGenerator<CreateChatCompletionStreamResponse>;

  create(
    body: CreateChatCompletionRequest
  ): Promise<CreateChatCompletionResponse> | AsyncGenerator<CreateChatCompletionStreamResponse> {
    if (body.stream === true) {
      return this.client.stream<CreateChatCompletionRequest, CreateChatCompletionStreamResponse>(
        'POST',
        '/v1/chat/completions',
        body,
        undefined,
        true
      );
    }

    return this.client
      .sendApiRequest<
        CreateChatCompletionRequest,
        CreateChatCompletionResponse
      >('POST', '/v1/chat/completions', body, undefined, true)
      .then((result) => unwrapResponse(result));
  }
}

/**
 * Chat resource with completions namespace
 */
export class Chat extends APIResource {
  completions: Completions;

  constructor(client: ResourceClient) {
    super(client);
    this.completions = new Completions(client);
  }
}

/**
 * Models resource
 */
export class Models extends APIResource {
  /**
   * List available models
   * Returns AsyncGenerator for iteration
   */
  async *list(): AsyncGenerator<Model> {
    const result = await this.client.sendApiRequest<void, ListModelsResponse>(
      'GET',
      '/v1/models',
      undefined,
      undefined,
      true
    );

    const response = unwrapResponse(result);
    for (const model of response.data) {
      yield model;
    }
  }

  /**
   * Retrieve a specific model
   */
  async retrieve(modelId: string): Promise<Model> {
    const result = await this.client.sendApiRequest<void, Model>(
      'GET',
      `/v1/models/${modelId}`,
      undefined,
      undefined,
      true
    );

    return unwrapResponse(result);
  }
}

/**
 * Embeddings resource
 */
export class Embeddings extends APIResource {
  /**
   * Create embeddings
   */
  async create(body: CreateEmbeddingRequest): Promise<CreateEmbeddingResponse> {
    const result = await this.client.sendApiRequest<
      CreateEmbeddingRequest,
      CreateEmbeddingResponse
    >('POST', '/v1/embeddings', body, undefined, true);

    return unwrapResponse(result);
  }
}

/**
 * Toolsets resource
 */
export class Toolsets extends APIResource {
  /**
   * List available toolsets
   */
  async list(): Promise<ListToolsetsResponse> {
    const result = await this.client.sendApiRequest<void, ListToolsetsResponse>(
      'GET',
      '/bodhi/v1/apps/toolsets',
      undefined,
      undefined,
      true
    );
    return unwrapResponse(result);
  }

  /**
   * Execute a tool on a toolset
   */
  async executeTool(
    toolsetId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const result = await this.client.sendApiRequest<{ params: Record<string, unknown> }, unknown>(
      'POST',
      `/bodhi/v1/apps/toolsets/${toolsetId}/tools/${toolName}/execute`,
      { params },
      undefined,
      true
    );
    return unwrapResponse(result);
  }
}

/**
 * MCPs resource
 */
export class Mcps extends APIResource {
  /**
   * List available MCP servers
   */
  async list(): Promise<ListMcpsResponse> {
    const result = await this.client.sendApiRequest<void, ListMcpsResponse>(
      'GET',
      '/bodhi/v1/apps/mcps',
      undefined,
      undefined,
      true
    );
    return unwrapResponse(result);
  }

  /**
   * List tools for a specific MCP server
   */
  async listTools(mcpId: string): Promise<McpToolsResponse> {
    const result = await this.client.sendApiRequest<void, McpToolsResponse>(
      'GET',
      `/bodhi/v1/apps/mcps/${mcpId}/tools`,
      undefined,
      undefined,
      true
    );
    return unwrapResponse(result);
  }

  /**
   * Refresh tools for a specific MCP server
   */
  async refreshTools(mcpId: string): Promise<McpToolsResponse> {
    const result = await this.client.sendApiRequest<void, McpToolsResponse>(
      'POST',
      `/bodhi/v1/apps/mcps/${mcpId}/tools/refresh`,
      undefined,
      undefined,
      true
    );
    return unwrapResponse(result);
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(
    mcpId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const result = await this.client.sendApiRequest<{ params: Record<string, unknown> }, unknown>(
      'POST',
      `/bodhi/v1/apps/mcps/${mcpId}/tools/${toolName}/execute`,
      { params },
      undefined,
      true
    );
    return unwrapResponse(result);
  }
}
