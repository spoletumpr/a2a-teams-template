import { createHash } from 'node:crypto';

/** Stable A2A context ID that avoids forwarding raw Teams conversation IDs. */
export function hashTeamsSessionId(tenantId: string, conversationId: string): string {
  // The newline separator prevents ambiguous concatenation before hashing.
  return `teams:${sha256(`${tenantId}\n${conversationId}`)}`;
}

/** Stable user metadata value; enabled only through KAGENT_FORWARD_USER_ID. */
export function hashTeamsUserId(tenantId: string, userId: string): string {
  // Include tenant ID so identical user IDs from different tenants do not map to
  // the same pseudonymous kagent-visible identifier.
  return `teams-user:${sha256(`${tenantId}\n${userId}`)}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
