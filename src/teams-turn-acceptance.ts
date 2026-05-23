import type { IMessageActivity } from '@microsoft/teams.api';
import type { ILogger } from '@microsoft/teams.common';

import type { SendKagentMessageOptions } from './a2a.js';
import type { AppConfig } from './config.js';
import { hashTeamsSessionId, hashTeamsUserId } from './identity.js';
import { sanitiseInboundText } from './sanitise.js';

export type TeamsTurnAcceptanceOptions = {
  readonly activity: IMessageActivity;
  readonly config: AppConfig;
  readonly log: ILogger;
  readonly send: (activity: string) => Promise<unknown>;
};

/**
 * Accept a Teams turn into the channel-neutral A2A request shape.
 *
 * This module concentrates the Teams acceptance implementation: tenant checks,
 * Mention-gated Conversation policy, inbound Boundary Sanitisation, Hashed Teams
 * Session construction, and Optional User Forwarding. Callers get one small
 * interface: either an A2A request or an expected user/channel rejection.
 */
export async function acceptTeamsTurn(options: TeamsTurnAcceptanceOptions): Promise<SendKagentMessageOptions | undefined> {
  const { activity, config, log, send } = options;
  const tenantId = activity.conversation.tenantId;

  // Tenant context is the minimum authorization signal available at this seam.
  // Without it, the connector cannot safely derive a session ID or apply the
  // configured allowlist.
  if (!tenantId) {
    log.warn('Skipping message without tenant ID.');
    await send('This message is missing tenant context.');
    return undefined;
  }

  if (!isAllowedTenant(config, tenantId)) {
    log.warn(`Skipping message from non-allowlisted tenant ${tenantId}.`);
    return undefined;
  }

  // In shared Teams scopes, require an explicit bot mention so the connector
  // behaves like a Request-response Connector rather than a channel listener.
  if (requiresMention(config, activity) && !activity.isRecipientMentioned()) {
    return undefined;
  }

  // Strip Teams mention markup before sending user intent to the kagent Agent.
  // This is channel hygiene, not DLP or prompt safety.
  const stripped = activity.stripMentionsText().text ?? '';
  const sanitised = sanitiseInboundText(stripped);
  if (!sanitised.ok) {
    await send(sanitised.reason);
    return undefined;
  }

  return toA2aRequest(config, activity, tenantId, sanitised.text);
}

function toA2aRequest(
  config: AppConfig,
  activity: IMessageActivity,
  tenantId: string,
  text: string,
): SendKagentMessageOptions {
  const request: SendKagentMessageOptions = {
    contextId: hashTeamsSessionId(tenantId, activity.conversation.id),
    text,
  };

  if (!config.kagentForwardUserId) {
    return request;
  }

  return {
    ...request,
    userId: hashTeamsUserId(tenantId, activity.from.aadObjectId ?? activity.from.id),
  };
}

function isAllowedTenant(config: AppConfig, tenantId: string): boolean {
  // With no allowlist, default to the single configured tenant. Operators can
  // opt into additional tenants explicitly through TEAMS_TENANT_ALLOWLIST.
  if (config.teamsTenantAllowlist.length === 0) {
    return tenantId === config.microsoftAppTenantId;
  }
  return config.teamsTenantAllowlist.includes(tenantId);
}

function requiresMention(config: AppConfig, activity: IMessageActivity): boolean {
  return config.teamsMentionOnly && activity.conversation.conversationType !== 'personal';
}
