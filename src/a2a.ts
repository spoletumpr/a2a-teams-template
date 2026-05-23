import type { AgentCard, Message, MessageSendParams, Part, Task } from '@a2a-js/sdk';
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
 * response extraction, and readiness. Teams authorization, mention policy, and
 * message sanitisation intentionally live in separate modules.
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

  async sendMessage(options: SendKagentMessageOptions): Promise<string> {
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

    const result = await client.sendMessage(params);
    const text = extractText(result);
    if (!text) {
      // Avoid sending an empty Teams message if the agent returns only non-text
      // parts or an empty task status.
      return 'The agent did not return a text response.';
    }
    return text;
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

/** Convert A2A message/task responses into the connector's plain-text contract. */
export function extractText(result: Message | Task): string {
  if (result.kind === 'message') {
    return partsToText(result.parts);
  }

  const statusText = result.status.message ? partsToText(result.status.message.parts) : '';
  const artifactText = result.artifacts?.flatMap((artifact) => artifact.parts).map(partToText).filter(Boolean).join('\n') ?? '';
  return [statusText, artifactText].filter(Boolean).join('\n').trim();
}

function partsToText(parts: readonly Part[]): string {
  // Preserve readable separation between text parts without interpreting the
  // content as Markdown, JSON, or Adaptive Cards.
  return parts.map(partToText).filter(Boolean).join('\n').trim();
}

function partToText(part: Part): string {
  // The v1 connector is text-first. Non-text A2A parts are ignored unless a
  // future explicit contract defines safe Teams rendering, such as cards.
  if (part.kind === 'text') {
    return part.text;
  }
  return '';
}

function randomId(): string {
  // Supported Node versions expose crypto.randomUUID. The fallback is only for
  // unusual runtimes and still avoids embedding Teams-derived identifiers.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
