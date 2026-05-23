import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientModule = vi.hoisted(() => ({
  createFromUrl: vi.fn(),
  getAgentCard: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@a2a-js/sdk/client', () => ({
  ClientFactory: vi.fn().mockImplementation(() => ({
    createFromUrl: clientModule.createFromUrl,
  })),
  JsonRpcTransportFactory: vi.fn().mockImplementation(() => ({})),
}));

const { KagentA2aClient } = await import('../src/a2a.js');

const agentCard = { name: 'kagent' };

describe('KagentA2aClient', () => {
  beforeEach(() => {
    clientModule.createFromUrl.mockReset();
    clientModule.getAgentCard.mockReset();
    clientModule.sendMessage.mockReset();
    clientModule.getAgentCard.mockResolvedValue(agentCard);
    clientModule.sendMessage.mockResolvedValue({
      kind: 'message',
      parts: [{ kind: 'text', text: 'agent response' }],
    });
    clientModule.createFromUrl.mockResolvedValue({
      getAgentCard: clientModule.getAgentCard,
      sendMessage: clientModule.sendMessage,
    });
  });

  it('normalizes the endpoint and reports readiness after initialization', async () => {
    const client = new KagentA2aClient('https://kagent.example.com/a2a///');

    expect(client.ready).toBe(false);

    await expect(client.initialize()).resolves.toBe(agentCard);

    expect(clientModule.createFromUrl).toHaveBeenCalledWith('https://kagent.example.com/a2a');
    expect(client.ready).toBe(true);
  });

  it('caches initialization across repeated calls', async () => {
    const client = new KagentA2aClient('https://kagent.example.com/a2a');

    await Promise.all([client.initialize(), client.initialize()]);
    await client.initialize();

    expect(clientModule.createFromUrl).toHaveBeenCalledTimes(1);
    expect(clientModule.getAgentCard).toHaveBeenCalledTimes(1);
  });

  it('sends a blocking text/plain A2A message with no raw Teams metadata by default', async () => {
    const client = new KagentA2aClient('https://kagent.example.com/a2a');

    await expect(
      client.sendMessage({
        contextId: 'teams:hashed-context',
        text: 'hello agent',
      }),
    ).resolves.toEqual({
      kind: 'message',
      parts: [{ kind: 'text', text: 'agent response' }],
    });

    expect(clientModule.sendMessage).toHaveBeenCalledWith({
      configuration: {
        acceptedOutputModes: ['text/plain'],
        blocking: true,
        historyLength: 1,
      },
      message: {
        kind: 'message',
        role: 'user',
        messageId: expect.any(String),
        contextId: 'teams:hashed-context',
        parts: [{ kind: 'text', text: 'hello agent' }],
        metadata: {},
      },
    });
  });

  it('includes only the hashed Teams user metadata when provided', async () => {
    const client = new KagentA2aClient('https://kagent.example.com/a2a');

    await client.sendMessage({
      contextId: 'teams:hashed-context',
      text: 'hello agent',
      userId: 'teams-user:hashed-user',
    });

    expect(clientModule.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          metadata: { teamsUserId: 'teams-user:hashed-user' },
        }),
      }),
    );
  });

  it('returns raw non-text A2A responses for the rendering boundary', async () => {
    clientModule.sendMessage.mockResolvedValue({
      kind: 'message',
      parts: [{ kind: 'data', data: { ignored: true } }],
    });
    const client = new KagentA2aClient('https://kagent.example.com/a2a');

    await expect(
      client.sendMessage({
        contextId: 'teams:hashed-context',
        text: 'hello agent',
      }),
    ).resolves.toEqual({
      kind: 'message',
      parts: [{ kind: 'data', data: { ignored: true } }],
    });
  });
});
