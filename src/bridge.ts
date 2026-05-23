import type { IMessageActivity } from '@microsoft/teams.api';
import type { ILogger } from '@microsoft/teams.common';

import type { SendKagentMessageOptions } from './a2a.js';
import type { AppConfig } from './config.js';
import { KagentA2aClient } from './a2a.js';
import { hashTeamsSessionId, hashTeamsUserId } from './identity.js';
import {
  sanitiseInboundText,
  sanitiseOutboundText,
} from './sanitise.js';

export type BridgeTurn = {
  readonly activity: IMessageActivity;
  readonly send: (activity: string | { type: 'typing' }) => Promise<unknown>;
};

type AcceptedMessage = {
  readonly tenantId: string;
  readonly text: string;
};

export class TeamsKagentBridge {
  private readonly config: AppConfig;
  private readonly client: KagentA2aClient;
  private readonly log: ILogger;

  constructor(config: AppConfig, client: KagentA2aClient, log: ILogger) {
    this.config = config;
    this.client = client;
    this.log = log;
  }

  async handleMessage(turn: BridgeTurn): Promise<void> {
    // Keep this public method as orchestration only: accept the Teams message,
    // call A2A, then render the response back to Teams.
    const accepted = await this.acceptMessage(turn);
    if (!accepted) {
      return;
    }

    await turn.send({ type: 'typing' });

  // After acceptance, no raw Teams conversation ID is forwarded; toA2aRequest
  // converts it to a hashed A2A context ID.
    const response = await this.client.sendMessage(this.toA2aRequest(turn.activity, accepted));
    await turn.send(sanitiseOutboundText(response, this.config.teamsAllowOutboundMentions));
  }

  private async acceptMessage(turn: BridgeTurn): Promise<AcceptedMessage | undefined> {
    // Expected user/channel rejections return undefined rather than throwing so
    // operational error handling remains reserved for genuine failures.
    const activity = turn.activity;
    const tenantId = activity.conversation.tenantId;

    // Tenant context is the minimum authorization signal available at this
    // boundary. Without it, the connector cannot safely derive a session ID or
    // apply the configured allowlist.
    if (!tenantId) {
      this.log.warn('Skipping message without tenant ID.');
      await turn.send('This message is missing tenant context.');
      return undefined;
    }

    if (!this.isAllowedTenant(tenantId)) {
      this.log.warn(`Skipping message from non-allowlisted tenant ${tenantId}.`);
      return undefined;
    }

    // In shared Teams scopes, require an explicit bot mention so the connector
    // behaves like a request-response adapter rather than a channel listener.
    if (this.requiresMention(activity) && !activity.isRecipientMentioned()) {
      return undefined;
    }

    // Strip Teams mention markup before sending user intent to kagent. The
    // sanitiser performs only channel hygiene, not DLP or prompt safety.
    const stripped = activity.stripMentionsText().text ?? '';
    const sanitised = sanitiseInboundText(stripped);
    if (!sanitised.ok) {
      await turn.send(sanitised.reason);
      return undefined;
    }

    return { tenantId, text: sanitised.text };
  }

  private toA2aRequest(activity: IMessageActivity, message: AcceptedMessage): SendKagentMessageOptions {
    // A2A receives a stable hashed session instead of raw Teams identifiers.
    const request = {
      contextId: hashTeamsSessionId(message.tenantId, activity.conversation.id),
      text: message.text,
    };

    if (!this.config.kagentForwardUserId) {
      // Default privacy posture: no per-user identifier crosses the A2A boundary.
      return request;
    }

    // Prefer the Entra object ID when present because it is stable; hash it
    // before forwarding so kagent receives only pseudonymous metadata.
    return {
      ...request,
      userId: hashTeamsUserId(message.tenantId, activity.from.aadObjectId ?? activity.from.id),
    };
  }

  private isAllowedTenant(tenantId: string): boolean {
    // With no allowlist, default to the single configured tenant. Operators can
    // opt into additional tenants explicitly through TEAMS_TENANT_ALLOWLIST.
    if (this.config.teamsTenantAllowlist.length === 0) {
      return tenantId === this.config.microsoftAppTenantId;
    }
    return this.config.teamsTenantAllowlist.includes(tenantId);
  }

  private requiresMention(activity: IMessageActivity): boolean {
    return this.config.teamsMentionOnly && activity.conversation.conversationType !== 'personal';
  }
}
