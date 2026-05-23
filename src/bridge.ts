import type { IMessageActivity } from '@microsoft/teams.api';
import type { ILogger } from '@microsoft/teams.common';

import type { AppConfig } from './config.js';
import { KagentA2aClient } from './a2a.js';
import { renderTeamsResponse } from './teams-rendering.js';
import { acceptTeamsTurn } from './teams-turn-acceptance.js';

export type BridgeTurn = {
  readonly activity: IMessageActivity;
  readonly send: (activity: string | { type: 'typing' }) => Promise<unknown>;
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
    const request = await acceptTeamsTurn({
      activity: turn.activity,
      config: this.config,
      log: this.log,
      send: turn.send,
    });
    if (!request) {
      return;
    }

    await turn.send({ type: 'typing' });

    // After acceptance, no raw Teams conversation ID is forwarded; the accepted
    // request already carries a Hashed Teams Session.
    const result = await this.client.sendMessage(request);
    await turn.send(renderTeamsResponse(result, this.config.teamsAllowOutboundMentions));
  }
}
