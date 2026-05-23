import { URL } from 'node:url';

import type { LogLevel } from '@microsoft/teams.common';

/** Runtime configuration for the connector's two trust boundaries:
 * Teams/Bot Framework ingress and kagent A2A egress.
 */
export type AppConfig = {
  readonly kagentA2aUrl: string;
  readonly microsoftAppId: string;
  readonly microsoftAppPassword?: string;
  readonly microsoftAppTenantId: string;
  readonly microsoftAppType: 'SingleTenant' | 'MultiTenant' | 'UserAssignedMSI';
  readonly teamsTenantAllowlist: readonly string[];
  readonly teamsMentionOnly: boolean;
  readonly teamsAllowOutboundMentions: boolean;
  readonly kagentForwardUserId: boolean;
  readonly logLevel: LogLevel;
  readonly port: number;
};

const LOG_LEVELS = new Set(['error', 'warn', 'info', 'debug', 'trace']);

/**
 * Parse environment variables once at startup so request handling can depend on
 * a validated, immutable configuration object.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const microsoftAppType = parseAppType(env.MICROSOFT_APP_TYPE ?? 'SingleTenant');
  const microsoftAppTenantId = required(env, 'MICROSOFT_APP_TENANT_ID');

  const config: AppConfig = {
    kagentA2aUrl: validateKagentA2aUrl(required(env, 'KAGENT_A2A_URL')),
    microsoftAppId: required(env, 'MICROSOFT_APP_ID'),
    microsoftAppTenantId,
    microsoftAppType,
    teamsTenantAllowlist: parseCsv(env.TEAMS_TENANT_ALLOWLIST),
    teamsMentionOnly: parseBoolean(env.TEAMS_MENTION_ONLY, true),
    teamsAllowOutboundMentions: parseBoolean(env.TEAMS_ALLOW_OUTBOUND_MENTIONS, false),
    kagentForwardUserId: parseBoolean(env.KAGENT_FORWARD_USER_ID, false),
    logLevel: parseLogLevel(env.LOG_LEVEL ?? 'info'),
    port: parsePort(env.PORT ?? '3978'),
  };

  const password = env.MICROSOFT_APP_PASSWORD?.trim();
  if (password) {
    return { ...config, microsoftAppPassword: password };
  }

  return config;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  // Trim values once at startup so accidental whitespace in Kubernetes values,
  // shell exports, or local env files does not cause confusing auth failures.
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseAppType(value: string): AppConfig['microsoftAppType'] {
  if (value === 'SingleTenant' || value === 'MultiTenant' || value === 'UserAssignedMSI') {
    return value;
  }
  throw new Error('MICROSOFT_APP_TYPE must be SingleTenant, MultiTenant, or UserAssignedMSI');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  // Accept only true/false. Values like yes, 1, enabled, or typos should fail
  // fast instead of silently changing production behavior.
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Expected boolean value, got ${value}`);
}

function parseCsv(value: string | undefined): readonly string[] {
  // Ignore empty items so a trailing comma does not create an impossible tenant
  // allowlist entry.
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLogLevel(value: string): LogLevel {
  if (LOG_LEVELS.has(value)) {
    return value as LogLevel;
  }
  throw new Error('LOG_LEVEL must be error, warn, info, debug, or trace');
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function validateKagentA2aUrl(value: string): string {
  // External traffic must use TLS. Plain HTTP is limited to local development
  // and Kubernetes service DNS where traffic is expected to stay in-cluster.
  const url = new URL(value);
  if (url.protocol === 'https:') {
    return url.toString().replace(/\/+$/, '');
  }

  if (url.protocol === 'http:' && isLikelyInClusterHost(url.hostname)) {
    return url.toString().replace(/\/+$/, '');
  }

  throw new Error('KAGENT_A2A_URL must use https:// unless it targets an in-cluster Kubernetes service name');
}

/**
 * Permit plaintext HTTP only for local development or Kubernetes service DNS.
 * This intentionally rejects arbitrary multi-label DNS names such as
 * `example.com`; external endpoints must use HTTPS.
 */
function isLikelyInClusterHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const kubernetesLabel = '[a-z0-9]([-a-z0-9]*[a-z0-9])?';
  const serviceName = new RegExp(`^${kubernetesLabel}$`);
  const serviceNamespace = new RegExp(`^${kubernetesLabel}\.${kubernetesLabel}\.svc(\.cluster\.local)?$`);

  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    serviceName.test(lower) ||
    serviceNamespace.test(lower)
  );
}
