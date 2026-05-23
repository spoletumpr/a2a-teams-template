import { fileURLToPath } from 'node:url';

import { App, ExpressAdapter } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import express from 'express';

import { KagentA2aClient } from './a2a.js';
import { TeamsKagentBridge } from './bridge.js';
import { AppConfig, loadConfig } from './config.js';

type AppLogger = ConsoleLogger;

/**
 * Compose the Teams Connector Template runtime and start serving traffic.
 *
 * Startup is intentionally eager: configuration is validated, A2A discovery is
 * completed, and only then does the Teams SDK begin accepting activities. That
 * keeps the request-response connector from receiving Teams turns before the
 * single configured kagent Agent endpoint is known to be usable.
 */
export async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new ConsoleLogger('a2a-teams-template', { level: config.logLevel });

  logRiskAcceptance(config, logger);

  const expressApp = express();
  const a2aClient = new KagentA2aClient(config.kagentA2aUrl);
  const bridge = new TeamsKagentBridge(config, a2aClient, logger.child('bridge'));
  const app = createTeamsApp(config, logger, expressApp);

  registerHealthRoute(expressApp, a2aClient);
  registerMessageHandler(app, bridge, logger);

  await a2aClient.initialize();
  await app.start(config.port);
}

/** Log only configuration-level risks; never log message content or raw conversation IDs. */
export function logRiskAcceptance(config: AppConfig, logger: AppLogger): void {
  if (config.microsoftAppType === 'MultiTenant') {
    logger.warn('MICROSOFT_APP_TYPE=MultiTenant requires a strict TEAMS_TENANT_ALLOWLIST in production.');
  }

  if (config.teamsAllowOutboundMentions) {
    logger.warn('TEAMS_ALLOW_OUTBOUND_MENTIONS=true can notify Teams users or channels from agent output.');
  }

  if (config.logLevel === 'debug' || config.logLevel === 'trace') {
    logger.warn('LOG_LEVEL=debug or trace may include sensitive SDK diagnostics. Use info or higher in production.');
  }
}

/**
 * Expose readiness based on A2A initialization, not just process liveness.
 * Kubernetes can keep the pod out of service until discovery has succeeded.
 */
export function registerHealthRoute(expressApp: express.Express, a2aClient: KagentA2aClient): void {
  expressApp.get('/healthz', (_req, res) => {
    if (!a2aClient.ready) {
      res.status(503).json({ status: 'starting' });
      return;
    }
    res.status(200).json({ status: 'ok' });
  });
}

/** Create the Teams SDK app while preserving Bot Framework as the auth boundary. */
export function createTeamsApp(config: AppConfig, logger: AppLogger, expressApp: express.Express): App {
  // Keep the Teams SDK as the Bot Framework authentication authority. The
  // connector should not implement its own token validation or anonymous mode.
  const appOptions = {
    logger,
    httpServerAdapter: new ExpressAdapter(expressApp),
    clientId: config.microsoftAppId,
    activity: {
      mentions: {
        stripText: false,
      },
    },
    ...(config.microsoftAppPassword ? { clientSecret: config.microsoftAppPassword } : {}),
    ...(config.microsoftAppType === 'MultiTenant' ? {} : { tenantId: config.microsoftAppTenantId }),
    ...(config.microsoftAppType === 'UserAssignedMSI' ? { managedIdentityClientId: config.microsoftAppId } : {}),
  };

  return new App(appOptions);
}

/**
 * Register the request-response turn handler.
 *
 * The bridge owns Teams-to-A2A behavior. This boundary owns the final
 * user-facing fallback so transient A2A or SDK failures do not leak details into
 * Teams and do not require the bridge to know about process-level logging.
 */
export function registerMessageHandler(app: App, bridge: TeamsKagentBridge, logger: AppLogger): void {
  app.on('message', async ({ activity, send }) => {
    try {
      await bridge.handleMessage({ activity, send });
    } catch (err) {
      logger.error(err);
      await send('The agent could not process this message.');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
