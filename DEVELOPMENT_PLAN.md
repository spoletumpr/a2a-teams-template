# Development Plan

## Phase 0: Verify upstream contracts

- Inspect existing kagent connector templates, especially Slack and Discord.
- Verify current Microsoft Teams TypeScript SDK and A2A client APIs.
- Verify whether kagent exposes typed A2A artifacts or response parts suitable for Adaptive Cards.
- If no explicit card contract exists, implement text-only rendering and document the card follow-up.

## Phase 1: Minimal connector skeleton

- Create TypeScript project with strict compiler settings.
- Add app bootstrap, environment parsing, structured logger, and `/healthz`.
- Initialize Teams SDK app using Azure Bot Service Channel configuration.
- Fetch kagent agent card at startup and mark readiness accordingly.

## Phase 2: Request-response bridge

- Implement mention-gated Teams message handler.
- Compute hashed Teams session ID using full SHA-256.
- Invoke the single configured kagent A2A endpoint.
- Return kagent response to the originating Teams conversation.
- Keep the connector stateless.

## Phase 3: Sanitisation and rendering

- Implement inbound sanitisation.
- Implement outbound text rendering.
- Add `TEAMS_ALLOW_OUTBOUND_MENTIONS` feature flag.
- Add tests for sanitiser behavior.
- Add Adaptive Card renderer only if a current kagent typed response contract exists.

## Phase 4: Helm and manifest

- Add Helm chart with Deployment, Service, ServiceAccount, optional Ingress, optional NetworkPolicy, PDB, and probes.
- Use existing secret references only.
- Add restricted pod/container security context.
- Add Teams app manifest with `personal`, `team`, and `groupchat` scopes.
- Do not request Microsoft Graph permissions.

## Phase 5: Documentation

- Write README with architecture, prerequisites, Azure setup, Helm deployment, Teams manifest setup, security model, troubleshooting, and contribution guidance.
- Lead production auth docs with Workload Identity / federated credentials.
- Document client secret fallback.
- Document known gap for sensitive-data guardrails and recommend tracking as a kagent roadmap issue.

## Validation checklist

- `npm ci`
- `npm run build`
- `npm test`
- `npm audit --omit=dev --audit-level=high`
- `docker build .`
- `helm lint helm/`
- `helm template helm/ ...`
- Validate Teams app manifest schema.
- Confirm no Graph permissions.
- Confirm no chart-rendered Secret.
- Confirm no local LLM dependencies.

## Development constraints

- Do not modify kagent core in v1.
- Do not add multi-agent routing.
- Do not add local LLM orchestration.
- Do not add proactive Teams notifications.
- Do not add distributed cache, Redis, or rate limiting in v1.
- Do not add connector-level DLP in v1.

## Future alignment with AgentHarness

V1 is an external standalone template. If kagent maintainers prefer Teams to become a first-class `AgentHarness` channel later, that should be handled as a separate kagent product change after the standalone connector proves the integration shape.