import { describe, it, expect } from 'vitest';
import { LoginOptionsBuilder } from './access-request';

describe('LoginOptionsBuilder', () => {
  it('omits exchange by default', () => {
    const opts = new LoginOptionsBuilder().setRole('scope_user_user').build();
    expect(opts.exchange).toBeUndefined();
  });

  it('setExchange() flags the options for exchange', () => {
    const opts = new LoginOptionsBuilder().setRole('scope_user_user').setExchange().build();
    expect(opts.exchange).toBe(true);
  });

  it('setExchange(false) keeps it disabled', () => {
    const opts = new LoginOptionsBuilder().setExchange(false).build();
    expect(opts.exchange).toBe(false);
  });

  it('composes exchange with role and requested resources', () => {
    const opts = new LoginOptionsBuilder()
      .setRole('scope_user_user')
      .setModelsAccess()
      .setModelsList()
      .setMcpsAccess()
      .setMcpsList()
      .setExchange()
      .build();
    expect(opts).toMatchObject({
      userRole: 'scope_user_user',
      exchange: true,
      requested: {
        models_access: true,
        models_list: true,
        mcps_access: true,
        mcps_list: true,
      },
    });
  });
});
