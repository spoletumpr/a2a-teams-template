# Configuration

This document lists the environment variables the connector reads at startup, their purpose, examples, and whether they are required.

- **KAGENT_A2A_URL**: URL of the kagent Agent A2A endpoint. Example: `https://kagent.example.com`. Required. Must use `https://` for external hosts.
- **MICROSOFT_APP_ID**: Azure App Registration (client) ID. Required.
- **MICROSOFT_APP_PASSWORD**: Azure App Registration client secret. Optional — recommended to store in a secret manager and _not_ in source control.
- **MICROSOFT_APP_TENANT_ID**: Azure AD tenant (directory) ID. Required for SingleTenant/MultiTenant deployments.
- **MICROSOFT_APP_TYPE**: One of `SingleTenant`, `MultiTenant`, or `UserAssignedMSI`. Defaults to `SingleTenant`.
- **TEAMS_TENANT_ALLOWLIST**: Comma-separated list of allowed Teams tenant IDs. Optional — when empty only `MICROSOFT_APP_TENANT_ID` is accepted.
- **TEAMS_MENTION_ONLY**: `true`/`false`. When `true`, the connector accepts turns only when the bot is explicitly mentioned in channel/group chats. Default: `true`.
- **TEAMS_ALLOW_OUTBOUND_MENTIONS**: `true`/`false`. When `true`, outbound Teams mention markup is preserved. Default: `false` (recommended for safety).
- **KAGENT_FORWARD_USER_ID**: `true`/`false`. When `true`, a hashed user identifier is forwarded to kagent. Default: `false`.
- **LOG_LEVEL**: `error`, `warn`, `info`, `debug`, or `trace`. Default: `info`.
- **PORT**: HTTP port to listen on. Default: `3978`.
 
## Security

- Never commit real secrets to the repository. Use your platform's secret manager (Kubernetes Secrets, GitHub Actions secrets, Azure Key Vault, etc.).
- `MICROSOFT_APP_PASSWORD` is optional in development for convenience, but production deployments should provide it via secure configuration.

## Local development

Copy `/.env.example` to `.env` and fill values for local testing. Example:

KAGENT_A2A_URL=https://kagent.example.com
MICROSOFT_APP_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_APP_PASSWORD=
MICROSOFT_APP_TENANT_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_APP_TYPE=SingleTenant
LOG_LEVEL=info
PORT=3978
