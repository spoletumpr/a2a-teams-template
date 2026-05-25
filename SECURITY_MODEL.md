# Security Model

Security-related requirements are indexed in `REQUIREMENTS_TRACEABILITY.md` alongside governing ADRs, implementation seams, tests, validation commands, and roadmap gaps.

## Trust boundaries

```text
Microsoft Teams user
  -> Azure Bot Service Channel
  -> Teams Connector Template
  -> kagent A2A endpoint
  -> kagent Agent and tools
```

The Teams Connector Template is a transport boundary. It validates and sanitises channel-specific input and output, but it does not own agent reasoning, tool authorization, or sensitive-data policy.

## Identity and authentication

- The default deployment model is single-tenant Microsoft Entra ID.
- Multi-tenant mode is allowed only as an explicit operator choice and must warn at startup.
- Production documentation should lead with Workload Identity / federated credentials.
- Client secrets are a development or compatibility fallback.
- Bot Framework activity validation must remain delegated to the official Teams SDK / Azure Bot Service path.
- The connector must not disable authority validation or add anonymous mode.

## Authorization boundaries

- Tool access belongs to kagent.
- The connector must not call Microsoft Graph APIs in v1.
- The Teams app manifest must not request Graph/RSC permissions in v1.
- Tenant allowlisting is available through `TEAMS_TENANT_ALLOWLIST`.
- Channel/group behavior is mention-gated outside personal chats.

## Data handling

- Raw Teams conversation IDs must not be forwarded to kagent.
- A2A session IDs use full SHA-256 hashed Teams session IDs.
- Raw Teams user IDs must not be forwarded to kagent in v1.
- Optional user forwarding sends only a stable hashed Teams user ID.
- INFO audit logs must not include message content or raw conversation IDs.

## Boundary sanitisation

The connector performs channel hygiene only:

- inbound size limit,
- control-character stripping,
- Unicode normalization,
- zero-width character rejection,
- outbound size limit,
- configurable outbound mention rendering.

This is not DLP and does not guarantee that agent responses are free of sensitive data.

## Known security gap: sensitive-data guardrails

The most important known gap is that v1 does not prevent a kagent agent from unintentionally disclosing sensitive data through Teams. That should be tracked as a kagent product roadmap item because the correct enforcement point is the agent/platform side, not a Teams-specific transport adapter.

## Kubernetes hardening

The Helm chart currently provides:

- restricted pod/container security context,
- dedicated ServiceAccount,
- readiness/liveness probes on `/healthz`,
- optional NetworkPolicy disabled by default for upstream compatibility.

NetworkPolicy is recommended for production, but disabled by default because external Bot Framework FQDN egress support varies by CNI.

Follow-up Kubernetes hardening candidates:

- `automountServiceAccountToken: false`,
- default resource requests and limits,
- PodDisruptionBudget.

## Secrets

- The chart must use existing secret references only.
- The chart must not render Kubernetes `Secret` resources.
- Secret values must not appear in `values.yaml`.
- Client-secret rotation requires pod restart unless the selected SDK/runtime supports live reload.

## Supply chain

- Use `npm ci`, not `npm install`, in reproducible builds.
- Commit `package-lock.json`.
- Use a non-root runtime image.
- Prefer distroless Node.js runtime unless Teams SDK requirements force another minimal base.
- Run `npm audit --omit=dev --audit-level=high` in CI or build validation.