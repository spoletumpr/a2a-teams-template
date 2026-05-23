# Requirements Traceability Index

This index is the managed navigation layer for the Teams Connector Template requirements baseline. It maps the reverse-engineered product contract to governing ADRs, repository glossary terms, implementation seams, tests, validation commands, and roadmap status.

Runtime behavior is unchanged by this document. Use it when reviewing changes against the current v1 contract or when splitting roadmap work into future issues.

## Documentation entry points

- `CONTEXT.md` defines the domain vocabulary that future changes should use.
- `PRODUCT_REQUIREMENTS.md` defines the current product requirements, non-goals, configuration contract, acceptance criteria, and known gaps.
- `SECURITY_MODEL.md` defines trust boundaries, identity handling, secure defaults, Kubernetes hardening, and known security gaps.
- `DEVELOPMENT_PLAN.md` captures the phased implementation plan and validation checklist.
- `docs/adr/` contains governing architectural decisions.

## Validation command catalog

| Command | Purpose |
|---|---|
| `npm ci` | Reproduce dependency installation from `package-lock.json`. |
| `npm run build` | Validate strict TypeScript compilation. |
| `npm test` | Run the behavior test suite. |
| `npm run coverage` | Confirm tested requirements remain covered at module seams. |
| `npm audit --omit=dev --audit-level=high` | Check production dependency vulnerabilities at high severity or above. |
| `docker build .` | Validate container build and runtime packaging. |
| `helm lint helm/a2a-teams-template` | Validate Helm chart metadata, values, and templates. |
| `helm template helm/a2a-teams-template` | Render Kubernetes manifests for deployment review. |

## Current v1 requirements map

| Requirement area | Current v1 behavior | Governing ADRs | Glossary terms | Deep module seams | Existing tests | Validation commands | Roadmap status |
|---|---|---|---|---|---|---|---|
| Repository and connector shape | The project is a Standalone Template Repository implemented as a TypeScript Connector. It remains outside kagent core and contains no local LLM, prompt orchestration, or tool routing. | `docs/adr/0001-standalone-typescript-pass-through-connector.md` | Teams Connector Template, Standalone Template Repository, TypeScript Connector, Pass-through Connector, kagent Agent | `package.json`, `tsconfig.json`, `src/bridge.ts`, `src/a2a.ts` | `test/bridge.test.ts`, `test/a2a.test.ts` | `npm ci`, `npm run build`, `npm test` | Current v1 baseline. |
| Teams ingress and request-response behavior | Teams activities arrive through Azure Bot Service Channel and are accepted as request-response turns. Personal chats are accepted directly; team/channel and group chat conversations are mention-gated. Microsoft Graph permissions are not part of v1. | `docs/adr/0002-request-response-single-agent-deployment.md`, `docs/adr/0003-secure-defaults-with-operator-risk-controls.md` | Azure Bot Service Channel, Request-response Connector, Mention-gated Conversation, Single-tenant Connector | `src/teams-turn-acceptance.ts`, `src/bridge.ts`, `src/index.ts` | `test/bridge.test.ts`, `test/index.test.ts` | `npm test`, `npm run build` | Proactive Teams notifications remain a roadmap item unless kagent exposes an outbound event or notification model. |
| kagent A2A integration | Each deployment targets exactly one configured `KAGENT_A2A_URL`, fetches the agent card before readiness, sends blocking `text/plain` A2A messages, and leaves reasoning and tool authorization to the kagent Agent. | `docs/adr/0001-standalone-typescript-pass-through-connector.md`, `docs/adr/0002-request-response-single-agent-deployment.md` | kagent Agent, Pass-through Connector, Single-agent Deployment, Request-response Connector | `src/a2a.ts`, `src/bridge.ts`, `src/index.ts` | `test/a2a.test.ts`, `test/bridge.test.ts`, `test/index.test.ts` | `npm test`, `npm run build` | Multi-agent routing is out of scope for v1. |
| Session and identity handling | A2A context IDs use full SHA-256 Hashed Teams Session values. Raw Teams conversation IDs are not forwarded. Optional User Forwarding is disabled by default and forwards only hashed stable user identifiers when enabled. | `docs/adr/0003-secure-defaults-with-operator-risk-controls.md` | Hashed Teams Session, Optional User Forwarding, Single-tenant Connector | `src/identity.ts`, `src/teams-turn-acceptance.ts`, `src/a2a.ts` | `test/identity.test.ts`, `test/bridge.test.ts`, `test/a2a.test.ts` | `npm test`, `npm run build` | Connector remains stateless; replay cache and per-user rate limiting are future hardening work. |
| Configuration and operator risk controls | Configuration is parsed once at startup with strict boolean, enum, port, tenant, and URL validation. Risk-acceptance settings warn at startup for MultiTenant mode, outbound mention rendering, and debug/trace logging. | `docs/adr/0003-secure-defaults-with-operator-risk-controls.md`, `docs/adr/0004-workload-identity-first-authentication.md` | Single-tenant Connector, Workload Identity Deployment, Configurable Mention Rendering, Optional User Forwarding | `src/config.ts`, `src/index.ts`, `.env.example` | `test/config.test.ts`, `test/index.test.ts` | `npm test`, `npm run build` | MultiTenant remains warning-only in the current security model. |
| Boundary Sanitisation | Inbound text is trimmed, normalized to NFC, stripped of unsafe control characters, rejected for zero-width characters, and capped at 16KB. Outbound text is capped at 28KB, zero-width characters are stripped, and Teams `<at>...</at>` mention markup is stripped unless explicitly allowed. | `docs/adr/0003-secure-defaults-with-operator-risk-controls.md` | Boundary Sanitisation, Configurable Mention Rendering, Sensitive Data Guardrail | `src/sanitise.ts`, `src/teams-turn-acceptance.ts`, `src/teams-rendering.ts` | `test/sanitise.test.ts`, `test/bridge.test.ts`, `test/teams-rendering.test.ts` | `npm test`, `npm run coverage`, `npm run build` | Sensitive Data Guardrail is kagent-side future work, not connector-level DLP. |
| Text-first Rendering | Plain text is rendered by default. A2A text parts are extracted from messages, task status, and task artifacts. Empty or non-text responses produce a safe fallback. Arbitrary JSON or Markdown is not inferred as an Adaptive Card. | `docs/adr/0005-text-first-rendering-and-card-contract.md`, `docs/adr/0003-secure-defaults-with-operator-risk-controls.md` | Text-first Rendering, Configurable Mention Rendering, Boundary Sanitisation | `src/teams-rendering.ts`, `src/sanitise.ts`, `src/bridge.ts` | `test/teams-rendering.test.ts`, `test/sanitise.test.ts`, `test/bridge.test.ts` | `npm test`, `npm run coverage`, `npm run build` | Adaptive Cards are deferred until kagent exposes an explicit typed A2A response part or artifact contract. |
| Runtime readiness and failure behavior | Startup validates configuration, logs accepted risks, initializes the A2A client, registers `/healthz`, and uses a safe Teams-facing fallback for runtime failures. `/healthz` returns `503` until A2A discovery succeeds. | `docs/adr/0002-request-response-single-agent-deployment.md`, `docs/adr/0003-secure-defaults-with-operator-risk-controls.md` | Request-response Connector, Single-agent Deployment, kagent Agent | `src/index.ts`, `src/a2a.ts`, `src/bridge.ts` | `test/index.test.ts`, `test/a2a.test.ts`, `test/bridge.test.ts` | `npm test`, `npm run build`, `docker build .` | Current v1 baseline. |
| Helm and Kubernetes deployment contract | Helm renders a restricted Deployment, Service, ServiceAccount, optional Ingress, optional NetworkPolicy, and probes. Secrets are referenced through Existing Secret Reference only; the chart does not render Kubernetes `Secret` resources or accept inline secret values. | `docs/adr/0003-secure-defaults-with-operator-risk-controls.md`, `docs/adr/0004-workload-identity-first-authentication.md` | Workload Identity Deployment, Production Network Policy, Existing Secret Reference, Single-tenant Connector | `helm/a2a-teams-template/values.yaml`, `helm/a2a-teams-template/values.schema.json`, `helm/a2a-teams-template/templates/deployment.yaml`, `helm/a2a-teams-template/templates/networkpolicy.yaml`, `Dockerfile` | Not covered by Vitest; validated through Helm rendering and template review. | `helm lint helm/a2a-teams-template`, `helm template helm/a2a-teams-template`, `docker build .` | PodDisruptionBudget and richer manifest validation remain candidates for follow-up hardening if required by maintainers. |
| Security and supply-chain posture | The connector delegates Bot Framework activity validation to the Teams SDK, avoids Graph/RSC permissions, uses a non-root runtime image, commits the lockfile, and treats Workload Identity as the production-first authentication direction. | `docs/adr/0003-secure-defaults-with-operator-risk-controls.md`, `docs/adr/0004-workload-identity-first-authentication.md` | Azure Bot Service Channel, Workload Identity Deployment, Existing Secret Reference, Sensitive Data Guardrail | `SECURITY_MODEL.md`, `Dockerfile`, `package-lock.json`, `helm/a2a-teams-template/` | `test/config.test.ts`, `test/index.test.ts`; Helm and Docker checks are command-validated. | `npm audit --omit=dev --audit-level=high`, `docker build .`, `helm lint helm/a2a-teams-template`, `helm template helm/a2a-teams-template` | Sensitive-data leakage prevention belongs to the kagent/platform roadmap. |

## Roadmap gap register

| Gap | Current status | Why it is not v1 behavior | Owning boundary | Related current requirements |
|---|---|---|---|---|
| Sensitive Data Guardrail | Known gap | Boundary Sanitisation is channel hygiene and cannot prove agent responses are free of sensitive data. | kagent Agent/platform policy | Boundary Sanitisation, Text-first Rendering, Security and supply-chain posture |
| Activity replay cache | Known hardening gap | The current connector is a Stateless Connector with no durable or distributed state. | Connector hardening, if accepted later | Session and identity handling, Runtime readiness and failure behavior |
| Per-user rate limiting | Known hardening gap | Rate limiting would require state and policy decisions outside the current pass-through request-response slice. | Connector or platform policy, if accepted later | Teams ingress, Session and identity handling |
| Adaptive Card rendering | Deferred enhancement | Safe rendering requires an explicit kagent/A2A structured response contract; arbitrary JSON or Markdown must not be guessed as cards. | kagent/A2A contract and Teams rendering seam | Text-first Rendering |
| Proactive Teams notifications | Out of scope | The connector is request-response only unless kagent later exposes an outbound event or notification model. | kagent outbound model and Teams ingress/runtime seam | Teams ingress and request-response behavior |
| Multi-agent routing | Out of scope | Single-agent Deployment prevents connector-side routing policy and keeps deployments independently configurable. | Deployment topology, not the current connector runtime | kagent A2A integration |
| Connector-level DLP | Out of scope | DLP would be a sensitive-data policy layer, not the Teams transport boundary. | kagent/platform policy | Boundary Sanitisation, Security and supply-chain posture |

## Review checklist for future changes

- Does the change preserve the glossary terms in `CONTEXT.md`?
- Does it update `PRODUCT_REQUIREMENTS.md` if the product contract changes?
- Does it need a new ADR under `docs/adr/` because it changes an accepted boundary?
- Is the affected deep module seam identified in the table above?
- Are tests added or updated at the stable public seam rather than private helpers?
- Are roadmap gaps still separated from current v1 behavior?
- Were the relevant validation commands from the catalog run?