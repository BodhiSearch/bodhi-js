import type { UserScope } from '@bodhiapp/ts-client';
import type { LoginOptions, LoginProgressCallback } from './types';

export class LoginOptionsBuilder {
  private options: LoginOptions = {};

  setRole(role: UserScope): this {
    this.options.role = role;
    return this;
  }

  setLlms(llms = true): this {
    this.options.llms = llms;
    return this;
  }

  setMcps(mcps = true): this {
    this.options.mcps = mcps;
    return this;
  }

  setReauthorize(reauthorize = true): this {
    this.options.reauthorize = reauthorize;
    return this;
  }

  addExtraScope(scope: string): this {
    if (!this.options.extraScopes) this.options.extraScopes = [];
    this.options.extraScopes.push(scope);
    return this;
  }

  setExtraScopes(scopes: string[]): this {
    this.options.extraScopes = [...scopes];
    return this;
  }

  setOnProgress(callback: LoginProgressCallback): this {
    this.options.onProgress = callback;
    return this;
  }

  build(): LoginOptions {
    return { ...this.options };
  }
}
