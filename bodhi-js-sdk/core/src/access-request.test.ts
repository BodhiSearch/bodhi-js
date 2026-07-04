import { describe, it, expect } from 'vitest';
import { LoginOptionsBuilder } from './access-request';

describe('LoginOptionsBuilder', () => {
  it('omits reauthorize by default', () => {
    const opts = new LoginOptionsBuilder().setRole('scope_user_user').build();
    expect(opts.reauthorize).toBeUndefined();
  });

  it('setReauthorize() flags the options for re-authorize', () => {
    const opts = new LoginOptionsBuilder().setRole('scope_user_user').setReauthorize().build();
    expect(opts.reauthorize).toBe(true);
  });

  it('setReauthorize(false) keeps it disabled', () => {
    const opts = new LoginOptionsBuilder().setReauthorize(false).build();
    expect(opts.reauthorize).toBe(false);
  });

  it('composes reauthorize with role and requested resources', () => {
    const opts = new LoginOptionsBuilder()
      .setRole('scope_user_user')
      .setModelsAccess()
      .setModelsList()
      .setMcpsAccess()
      .setMcpsList()
      .setReauthorize()
      .build();
    expect(opts).toMatchObject({
      userRole: 'scope_user_user',
      reauthorize: true,
      requested: {
        models_access: true,
        models_list: true,
        mcps_access: true,
        mcps_list: true,
      },
    });
  });
});
