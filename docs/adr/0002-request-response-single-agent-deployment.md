# Request-response single-agent deployment

Status: accepted

Each Teams connector deployment targets exactly one configured kagent A2A endpoint and operates in request-response mode: a Teams message invokes kagent, and the result is returned to the same Teams conversation. Dynamic multi-agent routing and kagent-initiated Teams notifications are out of scope for v1 because they would add connector-side policy, state, or rely on kagent capabilities not currently established.

## Consequences

- Different kagent agents should use separate connector deployments.
- Different deployments can carry different Teams app, tenant, secret, and security settings.
- Proactive Teams notifications can be revisited if kagent exposes an outbound event or notification model.