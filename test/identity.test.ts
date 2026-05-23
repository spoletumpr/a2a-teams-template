import { describe, expect, it } from 'vitest';

import { hashTeamsSessionId, hashTeamsUserId } from '../src/identity.js';

describe('hashTeamsSessionId', () => {
  it('uses the full sha256 digest of tenant and conversation IDs', () => {
    expect(hashTeamsSessionId('tenant', 'conversation')).toBe(
      'teams:a2585d78843bf69646dc1f73bffeba1b1c099c1b770c4945cfeedde17301fdb2',
    );
  });
});

describe('hashTeamsUserId', () => {
  it('uses a distinct user prefix for hashed user IDs', () => {
    expect(hashTeamsUserId('tenant', 'user')).toMatch(/^teams-user:[a-f0-9]{64}$/u);
  });
});
