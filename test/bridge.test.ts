import type { IMessageActivity } from '@microsoft/teams.api';
import type { ILogger } from '@microsoft/teams.common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KagentA2aClient, SendKagentMessageOptions } from '../src/a2a.js';
import type { AppConfig } from '../src/config.js';
import { TeamsKagentBridge } from '../src/bridge.js';
import { hashTeamsSessionId, hashTeamsUserId } from '../src/identity.js';

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

type ActivityOptions = {
  readonly tenantId?: string;
  readonly conversationId?: string;
  readonly conversationType?: string;
  readonly fromId?: string;
  readonly aadObjectId?: string;
  readonly mentioned?: boolean;
  readonly strippedText?: string;
};

function createActivity(options: ActivityOptions = {}): IMessageActivity {
  return {
    conversation: {
      id: options.conversationId ?? 'conversation-id',
      tenantId: options.tenantId,
      conversationType: options.conversationType ?? 'personal',
    },
    from: {
      id: options.fromId ?? 'from-id',
      aadObjectId: options.aadObjectId,
    },
    isRecipientMentioned: vi.fn(() => options.mentioned ?? false),
    stripMentionsText: vi.fn(() => ({ text: options.strippedText ?? ' hello agent ' })),
  } as unknown as IMessageActivity;
}

function createHarness(config: Partial<AppConfig> = {}) {
  const sent: Array<string | { type: 'typing' }> = [];
  const sendMessage = vi.fn(async (_options: SendKagentMessageOptions) => 'agent <at>Alice</at> response');
  const warn = vi.fn();
  const bridge = new TeamsKagentBridge(
    { ...BASE_CONFIG, ...config },
    { sendMessage } as unknown as KagentA2aClient,
    { warn, error: vi.fn() } as unknown as ILogger,
  );

  return {
    bridge,
    send: vi.fn(async (activity: string | { type: 'typing' }) => sent.push(activity)),
    sendMessage,
    sent,
    warn,
  };
}

describe('TeamsKagentBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards accepted personal messages with a hashed context ID', async () => {
    const { bridge, send, sendMessage, sent } = createHarness();

    await bridge.handleMessage({ activity: createActivity({ tenantId: 'tenant-id' }), send });

    expect(sendMessage).toHaveBeenCalledWith({
      contextId: hashTeamsSessionId('tenant-id', 'conversation-id'),
      text: 'hello agent',
    });
    expect(sendMessage.mock.calls[0]?.[0]?.contextId).not.toContain('conversation-id');
    expect(sent).toEqual([{ type: 'typing' }, 'agent  response']);
  });

  it('rejects messages without tenant context', async () => {
    const { bridge, send, sendMessage, sent, warn } = createHarness();

    await bridge.handleMessage({ activity: createActivity(), send });

    expect(warn).toHaveBeenCalledWith('Skipping message without tenant ID.');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual(['This message is missing tenant context.']);
  });

  it('ignores messages from non-allowlisted tenants', async () => {
    const { bridge, send, sendMessage, sent, warn } = createHarness({ teamsTenantAllowlist: ['tenant-a'] });

    await bridge.handleMessage({ activity: createActivity({ tenantId: 'tenant-b' }), send });

    expect(warn).toHaveBeenCalledWith('Skipping message from non-allowlisted tenant tenant-b.');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('requires a bot mention outside personal chats', async () => {
    const { bridge, send, sendMessage, sent } = createHarness();

    await bridge.handleMessage({
      activity: createActivity({ conversationType: 'channel', tenantId: 'tenant-id', mentioned: false }),
      send,
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('accepts mentioned channel messages', async () => {
    const { bridge, send, sendMessage, sent } = createHarness();

    await bridge.handleMessage({
      activity: createActivity({ conversationType: 'channel', tenantId: 'tenant-id', mentioned: true }),
      send,
    });

    expect(sendMessage).toHaveBeenCalledWith({
      contextId: hashTeamsSessionId('tenant-id', 'conversation-id'),
      text: 'hello agent',
    });
    expect(sent).toEqual([{ type: 'typing' }, 'agent  response']);
  });

  it('does not require a bot mention in personal chats', async () => {
    const { bridge, send, sendMessage } = createHarness();

    await bridge.handleMessage({
      activity: createActivity({ conversationType: 'personal', tenantId: 'tenant-id', mentioned: false }),
      send,
    });

    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('sends sanitisation rejection reasons without calling A2A', async () => {
    const { bridge, send, sendMessage, sent } = createHarness();

    await bridge.handleMessage({ activity: createActivity({ tenantId: 'tenant-id', strippedText: 'bad\u200Btext' }), send });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual(['Messages containing zero-width characters are not accepted.']);
  });

  it('forwards a hashed user ID only when user forwarding is enabled', async () => {
    const { bridge, send, sendMessage } = createHarness({ kagentForwardUserId: true });

    await bridge.handleMessage({
      activity: createActivity({ aadObjectId: 'aad-object-id', fromId: 'from-id', tenantId: 'tenant-id' }),
      send,
    });

    expect(sendMessage).toHaveBeenCalledWith({
      contextId: hashTeamsSessionId('tenant-id', 'conversation-id'),
      text: 'hello agent',
      userId: hashTeamsUserId('tenant-id', 'aad-object-id'),
    });
  });

  it('falls back to the Teams from ID when no Entra object ID is present', async () => {
    const { bridge, send, sendMessage } = createHarness({ kagentForwardUserId: true });

    await bridge.handleMessage({
      activity: createActivity({ fromId: 'from-id', tenantId: 'tenant-id' }),
      send,
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: hashTeamsUserId('tenant-id', 'from-id'),
      }),
    );
  });

  it('allows outbound Teams mention tags only when configured', async () => {
    const { bridge, send, sent } = createHarness({ teamsAllowOutboundMentions: true });

    await bridge.handleMessage({ activity: createActivity({ tenantId: 'tenant-id' }), send });

    expect(sent).toEqual([{ type: 'typing' }, 'agent <at>Alice</at> response']);
  });
});
