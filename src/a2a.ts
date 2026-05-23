import type { AgentCard, Message, MessageSendParams, Task } from '@a2a-js/sdk';
import { Client, ClientFactory, JsonRpcTransportFactory } from '@a2a-js/sdk/client';

/**
 * Channel-neutral request shape used by the A2A adapter.
 * Teams-specific details are normalized by the bridge before reaching this file.
 */
export type SendKagentMessageOptions = {
  readonly contextId: string;
  readonly text: string;
  readonly userId?: string;
};

/**
 * Thin wrapper around the A2A SDK for one configured kagent Agent endpoint.
 *
 * This module owns only A2A concerns: endpoint discovery, request construction,
 * raw response forwarding, and readiness. Teams authorization, mention policy,
 * response rendering, and message sanitisation intentionally live in separate
 * modules.
 */
export class KagentA2aClient {
  private readonly baseUrl: string;
  private readonly factory: ClientFactory;

  // Cached after successful discovery. The connector remains stateless for
  // conversations, but it should not re-fetch the agent card on every turn.
  private client?: Client;
  private agentCard?: AgentCard;

  // Multiple callers may initialize at the same time during startup/first use.
  // Caching the promise prevents duplicate discovery calls and races.
  private initPromise?: Promise<AgentCard>;

  constructor(baseUrl: string) {
    // URL scheme validation happens in config.ts. This normalization only keeps
    // SDK URL construction predictable when operators include trailing slashes.
    this.baseUrl = baseUrl.replace(/\/+$/, '');

    // Keep the transport list explicit. Adding more transports expands the
    // runtime/security surface and should be a deliberate product decision.
    this.factory = new ClientFactory({
      transports: [new JsonRpcTransportFactory()],
    });
  }

  get ready(): boolean {
    // Health checks should report ready only when both discovery and client
    // construction have succeeded.
    return this.agentCard !== undefined && this.client !== undefined;
  }

  async initialize(): Promise<AgentCard> {
    // Fast path after eager startup initialization.
    if (this.agentCard) return this.agentCard;

    // Cache the in-flight promise, not just the final card, to avoid concurrent
    // requests creating multiple SDK clients.
    this.initPromise ??= this.resolve();
    return this.initPromise;
  }

  async sendMessage(options: SendKagentMessageOptions): Promise<Message | Task> {
    // Defensive lazy initialization. main() initializes eagerly so bad endpoint
    // configuration normally fails before serving traffic.
    await this.initialize();
    const client = this.client;
    if (!client) {
      throw new Error('A2A client was not initialized');
    }

    const metadata: Record<string, unknown> = {};
    if (options.userId) {
      // Optional user forwarding carries only the connector's hashed user ID.
      // Raw Teams user identifiers must not cross the A2A boundary.
      metadata.teamsUserId = options.userId;
    }

    // Conservative v1 A2A behavior:
    // - text/plain only because Teams rendering is text-first;
    // - blocking because the connector is request-response only;
    // - short history because kagent owns memory and conversation policy.
    const params: MessageSendParams = {
      configuration: {
        acceptedOutputModes: ['text/plain'],
        blocking: true,
        historyLength: 1,
      },
      message: {
        kind: 'message',
        role: 'user',
        // Random per-message ID for A2A tracking. It intentionally contains no
        // raw Teams tenant, user, or conversation identifier.
        messageId: randomId(),
        // contextId is produced by identity.ts and is already pseudonymized.
        contextId: options.contextId,
        parts: [{ kind: 'text', text: options.text }],
        metadata,
      },
    };

    return client.sendMessage(params);
  }

  private async resolve(): Promise<AgentCard> {
    // Startup readiness depends on fetching the agent card. This fails fast for
    // misconfigured endpoints and keeps /healthz at 503 until A2A is usable.
    const client = await this.factory.createFromUrl(this.baseUrl);
    const card = await client.getAgentCard();
    this.client = client;
    this.agentCard = card;
    return card;
  }
}

function randomId(): string {
  // Supported Node versions expose crypto.randomUUID. The fallback is only for
  // unusual runtimes and still avoids embedding Teams-derived identifiers.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
