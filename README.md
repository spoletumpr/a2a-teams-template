# A2A Teams Template

`a2a-teams-template` is a standalone kagent ecosystem template that lets Microsoft Teams users interact with one configured kagent Agent through A2A.

## Documentation map

- `REQUIREMENTS_TRACEABILITY.md` is the managed requirements index. It maps each major requirement area to governing ADRs, glossary terms, implementation seams, tests, validation commands, and roadmap status.
- `CONTEXT.md` defines the repository domain vocabulary.
- `PRODUCT_REQUIREMENTS.md` defines the current product contract, configuration requirements, acceptance criteria, and known gaps.
- `SECURITY_MODEL.md` defines trust boundaries, secure defaults, identity handling, Kubernetes hardening, and security roadmap gaps.
- `DEVELOPMENT_PLAN.md` captures the phased implementation plan and validation checklist.
- `docs/adr/` records accepted architectural decisions.

## V1 connector behavior

This repository implements a request-response, pass-through Teams Connector Template. Microsoft Teams sends an activity through Azure Bot Service, the connector accepts or ignores the turn, sends one text request to the configured kagent A2A endpoint, then returns the rendered text response to the same Teams conversation.

The connector does not own agent reasoning, prompt orchestration, tool selection, tool permissions, or agent policy. Those responsibilities stay with the configured kagent Agent.

For requirement-to-code traceability, tests, ADRs, validation commands, and roadmap gaps, use `REQUIREMENTS_TRACEABILITY.md` as the index.

### Teams activity acceptance

- Personal chats are accepted directly when the message has tenant context and passes tenant checks.
- Team/channel conversations and group chats are mention-gated by default: the connector responds only when the bot is explicitly mentioned.
- Accepted turns have Teams mention markup stripped before their text is sent to kagent.
- Messages without tenant context are rejected with a safe user-facing response.
- Messages from non-allowlisted tenants are ignored.

Tenant handling defaults to a single-tenant connector. If `TEAMS_TENANT_ALLOWLIST` is not set, only `MICROSOFT_APP_TENANT_ID` is accepted. If `TEAMS_TENANT_ALLOWLIST` is set, only tenants in that explicit comma-separated allowlist are accepted.

### Single-agent A2A endpoint contract

Each deployment targets exactly one kagent Agent through `KAGENT_A2A_URL`. The connector fetches the configured agent card during startup and `/healthz` remains unavailable until that discovery succeeds.

For accepted turns, the connector constructs a blocking A2A text request from the sanitised Teams message. It does not route across agents, choose tools, alter kagent policy, or add local LLM behavior.

### Hashed Teams Session and Optional User Forwarding

The A2A context ID is a Hashed Teams Session, not a raw Teams conversation identifier. It is formatted as `teams:<64 lowercase hex SHA-256 digest>` and is derived from the tenant and conversation identifiers so kagent receives stable per-conversation continuity without receiving the raw Teams conversation ID.

Optional User Forwarding is disabled by default. When `KAGENT_FORWARD_USER_ID=true`, the connector forwards only a stable hashed Teams user identifier. Raw Teams user IDs are not forwarded as acceptable v1 behavior.

### Text-first Rendering and mentions

The connector renders plain text by default. It extracts text from A2A message parts, task status messages, and task artifacts, then joins readable text parts with newlines. Empty or non-text responses produce a safe fallback message.

The connector does not infer Adaptive Cards from arbitrary JSON or Markdown. Adaptive Card relay is deferred until kagent/A2A exposes an explicit typed response part or artifact contract that is safe to render in Teams.

Outbound Teams mention markup is configurable. `TEAMS_ALLOW_OUTBOUND_MENTIONS=false` is the default and strips `<at>...</at>` markup before sending responses to Teams. Setting `TEAMS_ALLOW_OUTBOUND_MENTIONS=true` is an explicit operator risk acceptance and logs a startup warning.

### Boundary Sanitisation

Boundary Sanitisation is Teams channel hygiene, not DLP, content moderation, prompt-injection defense, or a Sensitive Data Guardrail.

Inbound text is normalised to Unicode NFC, has unsafe control characters stripped, rejects zero-width characters, and is capped at 16KB. Outbound text has zero-width characters stripped, is capped at 28KB, and has Teams mention markup stripped unless outbound mention rendering is explicitly enabled.

Sensitive-data leakage prevention belongs to kagent or platform policy and remains a documented roadmap gap.

### Failure behavior and safe fallbacks

- Unaccepted shared-scope messages are ignored so the connector does not behave like an always-on channel listener.
- Invalid user input receives concise safe responses such as requests for text-only input or shorter messages.
- Empty or non-text kagent responses render as `The agent did not return a text response.`
- Runtime readiness is exposed through `/healthz`, which returns unavailable until the kagent agent card has been fetched successfully.

## Validation quick start

- `npm ci`
- `npm run build`
- `npm test`
- `helm lint helm/a2a-teams-template`
- `helm template helm/a2a-teams-template`

Use `REQUIREMENTS_TRACEABILITY.md` to choose the validation commands relevant to a specific requirement area.

## Configuration

Configuration is provided via environment variables. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for a full list and examples, and use `/.env.example` as a starting point for local development.
