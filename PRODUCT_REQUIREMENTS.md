# Product Requirements: A2A Teams Template

## Summary

`a2a-teams-template` is a standalone kagent ecosystem template that lets Microsoft Teams users interact with one configured kagent agent through A2A. It is intended for upstream contribution to the kagent product ecosystem.

## Goals

- Provide an idiomatic Microsoft Teams connector for kagent.
- Keep the connector minimal: Teams message in, A2A task to kagent, Teams response out.
- Use stable Microsoft Teams SDK support in TypeScript.
- Preserve kagent ownership of reasoning, tool access, and agent policy.
- Provide secure defaults without making the upstream template enterprise-specific.

## Non-goals

- No local LLM, prompt orchestration, or tool routing inside the connector.
- No Microsoft Graph integration in v1.
- No proactive or unsolicited Teams notifications in v1.
- No multi-agent routing in one deployment.
- No kagent core changes in v1.
- No connector-level DLP or sensitive-data guardrail in v1.

## Users

- kagent users who want to expose a kagent agent through Microsoft Teams.
- kagent maintainers reviewing an upstream connector template.
- Platform operators deploying the connector into Kubernetes/AKS.

## Functional requirements

### Teams integration

- The connector MUST use Azure Bot Service as the Teams channel path.
- The connector MUST support Teams scopes `personal`, `team`, and `groupchat`.
- In personal chats, the connector SHOULD respond to accepted messages directly.
- In team/channel and group chat contexts, the connector MUST respond only when the bot is explicitly mentioned.
- The connector MUST NOT request Microsoft Graph permissions in v1.

### kagent integration

- Each connector deployment MUST target exactly one configured kagent A2A endpoint via `KAGENT_A2A_URL`.
- The connector MUST invoke kagent as a pass-through A2A client.
- The connector MUST NOT decide tool access, route between tools, or modify kagent reasoning policy.
- The connector MUST fetch the configured kagent agent card at startup.
- `/healthz` MUST return `503` until the agent card has been fetched successfully.

### Session and identity

- The connector MUST use a hashed Teams session identifier as the A2A session ID.
- Session ID format: `teams:<64 lowercase hex SHA-256 digest>`.
- Digest input: `tenant_id + "\n" + conversation_id`.
- The connector MUST NOT pass raw Teams conversation IDs to kagent.
- The connector MUST hash user AAD object IDs in audit logs.
- User identity forwarding to kagent MUST be disabled by default.
- If enabled with `KAGENT_FORWARD_USER_ID=true`, the connector MUST forward only a hashed stable Teams user identifier.

### Rendering

- The connector MUST render plain text by default.
- The connector MUST NOT infer Adaptive Cards from arbitrary JSON or Markdown.
- The connector MAY relay Adaptive Cards only if kagent exposes an explicit typed A2A response part or artifact with an Adaptive Card content type.
- If no such kagent contract exists, Adaptive Cards MUST be documented as a future enhancement.

### Boundary sanitisation

- The connector MUST cap inbound text at 16KB.
- The connector MUST strip control characters except `\n`, `\r`, and `\t`.
- The connector MUST normalize inbound text to Unicode NFC.
- The connector MUST reject inbound text containing zero-width characters: U+200B, U+200C, U+200D, U+FEFF.
- The connector MUST cap outbound text at 28KB.
- The connector MUST provide `TEAMS_ALLOW_OUTBOUND_MENTIONS=false` by default.
- When `TEAMS_ALLOW_OUTBOUND_MENTIONS=false`, the connector MUST strip outbound Teams `<at>...</at>` mention markup.
- When `TEAMS_ALLOW_OUTBOUND_MENTIONS=true`, the connector MUST log a startup warning.

## Configuration contract

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `KAGENT_A2A_URL` | yes | none | Full A2A endpoint for one kagent agent. |
| `MICROSOFT_APP_ID` | yes | none | Entra App Registration client ID. |
| `MICROSOFT_APP_PASSWORD` | no | none | Client secret fallback; omit for workload identity where supported. |
| `MICROSOFT_APP_TENANT_ID` | yes | none | Tenant ID for single-tenant default. |
| `MICROSOFT_APP_TYPE` | no | `SingleTenant` | Allow `MultiTenant` with warnings. |
| `TEAMS_TENANT_ALLOWLIST` | no | none | Comma-separated allowed tenant IDs. |
| `TEAMS_MENTION_ONLY` | no | context-dependent | Explicit mention behavior override. |
| `TEAMS_ALLOW_OUTBOUND_MENTIONS` | no | `false` | Risk-acceptance flag for outbound mention rendering. |
| `KAGENT_FORWARD_USER_ID` | no | `false` | Forward hashed Teams user ID to kagent. |
| `LOG_LEVEL` | no | `info` | `debug` may include sensitive diagnostic content and must warn at startup. |
| `PORT` | no | `3978` | Bot Framework convention. |

## Known gaps and roadmap

- Sensitive-data guardrails: v1 boundary sanitisation does not prevent agents from leaking sensitive data. This should be tracked as a kagent product follow-up.
- Activity replay cache: not included in v1.
- Per-user rate limiting: not included in v1.
- Adaptive Card rendering: depends on an explicit kagent/A2A structured response contract.
- Proactive Teams notifications: out of scope unless kagent exposes an outbound event or notification model.

## Acceptance criteria

- `npm ci && npm run build` succeeds.
- Sanitiser tests pass.
- `helm lint helm/` passes.
- `helm template helm/` renders a Deployment with restricted pod/container security context.
- Chart uses existing secret references only and does not render a Kubernetes `Secret`.
- Teams manifest has no Microsoft Graph permission requests.
- Code contains no local LLM dependency and no raw `botbuilder` dependency unless required transitively by the Teams SDK.