import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KagentA2aClient } from '../src/a2a.js';
import type { TeamsKagentBridge } from '../src/bridge.js';
import type { AppConfig } from '../src/config.js';

const teamsModule = vi.hoisted(() => ({
  App: vi.fn((options: unknown) => ({ options })),
  ExpressAdapter: vi.fn((server: unknown) => ({ server })),
}));

vi.mock('@microsoft/teams.apps', () => ({
  App: teamsModule.App,
  ExpressAdapter: teamsModule.ExpressAdapter,
}));

const {
  createTeamsApp,
  logRiskAcceptance,
  registerHealthRoute,
  registerMessageHandler,
} = await import('../src/index.js');

const BASE_CONFIG: AppConfig = {
  kagentA2aUrl: 'https://kagent.example.com/a2a',
  kagentForwardUserId: false,
  logLevel: 'info',
  microsoftAppId: 'app-id',
  microsoftAppTenantId: 'tenant-id',
  microsoftAppType: 'SingleTenant',
  port: 3978,
  teamsAllowOutboundMentions: false,
  teamsMentionOnly: true,
  teamsTenantAllowlist: [],
};

describe('index runtime wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs explicit operator risk acceptances without message content', () => {
    const warn = vi.fn();

    logRiskAcceptance(
      {
        ...BASE_CONFIG,
        logLevel: 'debug',
        microsoftAppType: 'MultiTenant',
        teamsAllowOutboundMentions: true,
      },
      { warn } as unknown as Parameters<typeof logRiskAcceptance>[1],
    );

    expect(warn).toHaveBeenCalledWith('MICROSOFT_APP_TYPE=MultiTenant requires a strict TEAMS_TENANT_ALLOWLIST in production.');
    expect(warn).toHaveBeenCalledWith('TEAMS_ALLOW_OUTBOUND_MENTIONS=true can notify Teams users or channels from agent output.');
    expect(warn).toHaveBeenCalledWith('LOG_LEVEL=debug or trace may include sensitive SDK diagnostics. Use info or higher in production.');
  });

  it('creates a single-tenant Teams app that leaves mention stripping to the bridge', () => {
    const logger = { warn: vi.fn() };
    const expressApp = { name: 'express-app' };

    createTeamsApp(
      { ...BASE_CONFIG, microsoftAppPassword: 'secret' },
      logger as unknown as Parameters<typeof createTeamsApp>[1],
      expressApp as unknown as Parameters<typeof createTeamsApp>[2],
    );

    expect(teamsModule.ExpressAdapter).toHaveBeenCalledWith(expressApp);
    expect(teamsModule.App).toHaveBeenCalledWith({
      logger,
      httpServerAdapter: { server: expressApp },
      clientId: 'app-id',
      activity: {
        mentions: {
          stripText: false,
        },
      },
      clientSecret: 'secret',
      tenantId: 'tenant-id',
    });
  });

  it('creates a multi-tenant Teams app without a tenant binding', () => {
    createTeamsApp(
      { ...BASE_CONFIG, microsoftAppType: 'MultiTenant' },
      { warn: vi.fn() } as unknown as Parameters<typeof createTeamsApp>[1],
      {} as unknown as Parameters<typeof createTeamsApp>[2],
    );

    expect(teamsModule.App.mock.calls[0]?.[0]).not.toHaveProperty('tenantId');
  });

  it('binds user-assigned managed identity to the Microsoft app ID', () => {
    createTeamsApp(
      { ...BASE_CONFIG, microsoftAppType: 'UserAssignedMSI' },
      { warn: vi.fn() } as unknown as Parameters<typeof createTeamsApp>[1],
      {} as unknown as Parameters<typeof createTeamsApp>[2],
    );

    expect(teamsModule.App.mock.calls[0]?.[0]).toMatchObject({
      tenantId: 'tenant-id',
      managedIdentityClientId: 'app-id',
    });
  });

  it('reports starting until A2A discovery has completed', () => {
    let handler: ((req: unknown, res: { status: (code: number) => unknown; json: (body: unknown) => unknown }) => void) | undefined;
    const expressApp = {
      get: vi.fn((_path: string, routeHandler: typeof handler) => {
        handler = routeHandler;
      }),
    };
    const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);

    registerHealthRoute(expressApp as unknown as Parameters<typeof registerHealthRoute>[0], { ready: false } as KagentA2aClient);
    handler?.({}, res);

    expect(expressApp.get).toHaveBeenCalledWith('/healthz', expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'starting' });
  });

  it('reports healthy after A2A discovery has completed', () => {
    let handler: ((req: unknown, res: { status: (code: number) => unknown; json: (body: unknown) => unknown }) => void) | undefined;
    const expressApp = {
      get: vi.fn((_path: string, routeHandler: typeof handler) => {
        handler = routeHandler;
      }),
    };
    const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);

    registerHealthRoute(expressApp as unknown as Parameters<typeof registerHealthRoute>[0], { ready: true } as KagentA2aClient);
    handler?.({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('routes Teams messages through the bridge', async () => {
    let handler: ((turn: { activity: unknown; send: (activity: string) => Promise<unknown> }) => Promise<void>) | undefined;
    const app = {
      on: vi.fn((_event: string, routeHandler: typeof handler) => {
        handler = routeHandler;
      }),
    };
    const bridge = { handleMessage: vi.fn(async () => undefined) };
    const send = vi.fn(async () => undefined);

    registerMessageHandler(
      app as unknown as Parameters<typeof registerMessageHandler>[0],
      bridge as unknown as TeamsKagentBridge,
      { error: vi.fn() } as unknown as Parameters<typeof registerMessageHandler>[2],
    );
    await handler?.({ activity: 'activity', send });

    expect(app.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(bridge.handleMessage).toHaveBeenCalledWith({ activity: 'activity', send });
  });

  it('sends a safe Teams fallback when the request-response turn fails', async () => {
    let handler: ((turn: { activity: unknown; send: (activity: string) => Promise<unknown> }) => Promise<void>) | undefined;
    const app = {
      on: vi.fn((_event: string, routeHandler: typeof handler) => {
        handler = routeHandler;
      }),
    };
    const err = new Error('A2A timeout');
    const bridge = { handleMessage: vi.fn(async () => Promise.reject(err)) };
    const logger = { error: vi.fn() };
    const send = vi.fn(async () => undefined);

    registerMessageHandler(
      app as unknown as Parameters<typeof registerMessageHandler>[0],
      bridge as unknown as TeamsKagentBridge,
      logger as unknown as Parameters<typeof registerMessageHandler>[2],
    );
    await handler?.({ activity: 'activity', send });

    expect(logger.error).toHaveBeenCalledWith(err);
    expect(send).toHaveBeenCalledWith('The agent could not process this message.');
  });
});
