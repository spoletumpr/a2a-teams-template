# Workload Identity first authentication

Status: accepted

Production documentation will lead with Workload Identity / federated credentials rather than client secrets. Client secrets remain a fallback for development or environments where workload identity is unavailable, but the template should not normalize long-lived bot secrets as the preferred production path.

## Consequences

- The README should explain workload identity before client secrets.
- The Helm chart should support existing secret references for fallback client-secret deployments.
- Secret rotation guidance must state that secret-based deployments require pod restart unless runtime support for live reload is added.