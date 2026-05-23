import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

const BASE_ENV = {
  KAGENT_A2A_URL: 'https://kagent.example.com/a2a',
  MICROSOFT_APP_ID: 'app-id',
  MICROSOFT_APP_TENANT_ID: 'tenant-id',
};

describe('loadConfig', () => {
  it('accepts HTTPS A2A endpoints', () => {
    expect(loadConfig(BASE_ENV).kagentA2aUrl).toBe('https://kagent.example.com/a2a');
  });

  it('trims and normalizes trailing slashes from HTTPS A2A endpoints', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAGENT_A2A_URL: ' https://kagent.example.com/a2a/ ',
    });

    expect(config.kagentA2aUrl).toBe('https://kagent.example.com/a2a');
  });

  it('accepts HTTP for a Kubernetes service DNS name', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAGENT_A2A_URL: 'http://kagent.default.svc.cluster.local/a2a/',
    });

    expect(config.kagentA2aUrl).toBe('http://kagent.default.svc.cluster.local/a2a');
  });

  it('accepts HTTP for localhost and short Kubernetes service names', () => {
    expect(loadConfig({ ...BASE_ENV, KAGENT_A2A_URL: 'http://localhost/a2a' }).kagentA2aUrl).toBe(
      'http://localhost/a2a',
    );
    expect(loadConfig({ ...BASE_ENV, KAGENT_A2A_URL: 'http://kagent/a2a' }).kagentA2aUrl).toBe(
      'http://kagent/a2a',
    );
    expect(loadConfig({ ...BASE_ENV, KAGENT_A2A_URL: 'http://kagent.default.svc/a2a' }).kagentA2aUrl).toBe(
      'http://kagent.default.svc/a2a',
    );
  });

  it('rejects HTTP for external DNS names', () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        KAGENT_A2A_URL: 'http://kagent.example.com/a2a',
      }),
    ).toThrow('KAGENT_A2A_URL must use https:// unless it targets an in-cluster Kubernetes service name');
  });

  it('rejects invalid A2A URLs', () => {
    expect(() => loadConfig({ ...BASE_ENV, KAGENT_A2A_URL: 'not a url' })).toThrow();
  });

  it('requires the mandatory settings', () => {
    expect(() => loadConfig({ ...BASE_ENV, KAGENT_A2A_URL: '   ' })).toThrow('KAGENT_A2A_URL is required');
    expect(() => loadConfig({ ...BASE_ENV, MICROSOFT_APP_ID: '' })).toThrow('MICROSOFT_APP_ID is required');
    expect(() => loadConfig({ ...BASE_ENV, MICROSOFT_APP_TENANT_ID: undefined })).toThrow(
      'MICROSOFT_APP_TENANT_ID is required',
    );
  });

  it('uses secure defaults for optional settings', () => {
    expect(loadConfig(BASE_ENV)).toMatchObject({
      kagentForwardUserId: false,
      logLevel: 'info',
      microsoftAppType: 'SingleTenant',
      port: 3978,
      teamsMentionOnly: true,
      teamsTenantAllowlist: [],
    });
  });

  it('accepts all supported Microsoft app types', () => {
    expect(loadConfig({ ...BASE_ENV, MICROSOFT_APP_TYPE: 'SingleTenant' }).microsoftAppType).toBe('SingleTenant');
    expect(loadConfig({ ...BASE_ENV, MICROSOFT_APP_TYPE: 'MultiTenant' }).microsoftAppType).toBe('MultiTenant');
    expect(loadConfig({ ...BASE_ENV, MICROSOFT_APP_TYPE: 'UserAssignedMSI' }).microsoftAppType).toBe('UserAssignedMSI');
  });

  it('rejects unsupported Microsoft app types', () => {
    expect(() => loadConfig({ ...BASE_ENV, MICROSOFT_APP_TYPE: 'Personal' })).toThrow(
      'MICROSOFT_APP_TYPE must be SingleTenant, MultiTenant, or UserAssignedMSI',
    );
  });

  it('keeps outbound mentions disabled by default', () => {
    expect(loadConfig(BASE_ENV).teamsAllowOutboundMentions).toBe(false);
  });

  it('parses boolean settings with trimming and case normalization', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAGENT_FORWARD_USER_ID: ' TRUE ',
      TEAMS_ALLOW_OUTBOUND_MENTIONS: 'true',
      TEAMS_MENTION_ONLY: 'false',
    });

    expect(config.kagentForwardUserId).toBe(true);
    expect(config.teamsAllowOutboundMentions).toBe(true);
    expect(config.teamsMentionOnly).toBe(false);
  });

  it('uses boolean fallbacks for blank values', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAGENT_FORWARD_USER_ID: ' ',
      TEAMS_ALLOW_OUTBOUND_MENTIONS: '',
      TEAMS_MENTION_ONLY: ' ',
    });

    expect(config.kagentForwardUserId).toBe(false);
    expect(config.teamsAllowOutboundMentions).toBe(false);
    expect(config.teamsMentionOnly).toBe(true);
  });

  it('rejects invalid boolean settings', () => {
    expect(() => loadConfig({ ...BASE_ENV, TEAMS_MENTION_ONLY: 'yes' })).toThrow('Expected boolean value, got yes');
  });

  it('parses tenant allowlists as trimmed CSV values', () => {
    expect(
      loadConfig({
        ...BASE_ENV,
        TEAMS_TENANT_ALLOWLIST: ' tenant-a, ,tenant-b , ',
      }).teamsTenantAllowlist,
    ).toEqual(['tenant-a', 'tenant-b']);
  });

  it('accepts configured log levels and rejects unsupported levels', () => {
    expect(loadConfig({ ...BASE_ENV, LOG_LEVEL: 'debug' }).logLevel).toBe('debug');
    expect(() => loadConfig({ ...BASE_ENV, LOG_LEVEL: 'verbose' })).toThrow(
      'LOG_LEVEL must be error, warn, info, debug, or trace',
    );
  });

  it('parses and validates the port', () => {
    expect(loadConfig({ ...BASE_ENV, PORT: '8080' }).port).toBe(8080);
    expect(() => loadConfig({ ...BASE_ENV, PORT: '0' })).toThrow('PORT must be an integer between 1 and 65535');
    expect(() => loadConfig({ ...BASE_ENV, PORT: '65536' })).toThrow('PORT must be an integer between 1 and 65535');
    expect(() => loadConfig({ ...BASE_ENV, PORT: '3978.5' })).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('trims Microsoft app passwords and omits blank passwords', () => {
    expect(loadConfig({ ...BASE_ENV, MICROSOFT_APP_PASSWORD: ' secret ' }).microsoftAppPassword).toBe('secret');
    expect(loadConfig({ ...BASE_ENV, MICROSOFT_APP_PASSWORD: ' ' })).not.toHaveProperty('microsoftAppPassword');
  });
});
