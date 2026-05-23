# Secure defaults with operator risk controls

Status: accepted

The template will use secure defaults while exposing explicit feature flags for risks that operators may intentionally accept. Examples include single-tenant identity by default, existing secret references only, hashed sessions, optional hashed user forwarding, mention stripping by default, and optional NetworkPolicy disabled by default for upstream compatibility.

## Consequences

- `TEAMS_ALLOW_OUTBOUND_MENTIONS=false` by default, with a startup warning when enabled.
- `KAGENT_FORWARD_USER_ID=false` by default, forwarding only hashed user IDs when enabled.
- `networkPolicy.enabled=false` by default because FQDN egress support varies by Kubernetes CNI, but production docs strongly recommend enabling network controls.
- Sensitive-data guardrails remain a documented kagent product follow-up, not a connector-only feature.