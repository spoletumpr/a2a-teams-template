# A2A Teams Template

This context defines the product language for a Microsoft Teams connector template intended for contribution to the kagent ecosystem.

For requirements traceability, use `REQUIREMENTS_TRACEABILITY.md` to navigate from these glossary terms to governing ADRs, implementation seams, tests, validation commands, and roadmap status.

## Language

**Teams Connector Template**:
A reusable kagent ecosystem template that lets Microsoft Teams users interact with a kagent agent through A2A. It is intended as an upstream community contribution, not as a company-specific internal implementation.
_Avoid_: PayRetailers-only template, internal Teams bot, enterprise wrapper

**Standalone Template Repository**:
An independent repository for the Teams Connector Template, separate from kagent core, following the existing kagent connector-template contribution model.
_Avoid_: kagent core patch, in-tree Teams integration

**TypeScript Connector**:
The initial implementation of the Teams Connector Template using the stable TypeScript Microsoft Teams SDK and A2A client support.
_Avoid_: Python preview connector, C# enterprise connector

**kagent Agent**:
The agent exposed by kagent and invoked by the Teams Connector Template over A2A. The connector does not contain agent logic of its own.
_Avoid_: Teams agent, bridge LLM, local assistant

**Pass-through Connector**:
A connector that transports accepted Teams messages to the kagent Agent and returns its response without deciding tool access, routing, or reasoning policy. Tool selection and tool permissions belong to the kagent Agent.
_Avoid_: orchestrator, tool router, bridge agent

**Request-response Connector**:
A connector where Teams initiates a message, the connector invokes the kagent Agent, and the connector returns the result to the same Teams conversation. Kagent-initiated Teams notifications are out of scope unless kagent exposes an outbound event or notification model.
_Avoid_: proactive messaging, unsolicited notification bridge

**Single-agent Deployment**:
A Teams Connector Template deployment configured for exactly one kagent Agent endpoint. Different kagent agents should use separate deployments because they may need different Teams, security, or operational settings.
_Avoid_: dynamic agent router, multi-agent bridge

**Hashed Teams Session**:
A stable A2A session identifier derived from the Teams tenant ID and conversation ID using a full SHA-256 digest. It preserves per-conversation continuity without exposing raw Teams conversation identifiers.
_Avoid_: raw Teams conversation ID, shortened hash session

**Optional User Forwarding**:
An operator-controlled setting that forwards a stable hashed Teams user identifier to kagent when enabled. User identity is hashed in audit logs regardless, and raw Teams user identifiers are not forwarded in v1.
_Avoid_: raw user forwarding, implicit user metadata

**Mention-gated Conversation**:
A Teams team/channel or group chat conversation where the Teams Connector Template responds only when the bot is explicitly mentioned. Personal chats are not mention-gated.
_Avoid_: always-on channel bot, channel listener

**Single-tenant Connector**:
A Teams Connector Template deployment bound by default to one Microsoft Entra tenant. Multi-tenant deployment is possible, but is not the default path and requires explicit operator review.
_Avoid_: public SaaS bot, default multi-tenant bot

**Azure Bot Service Channel**:
The Teams integration path where Microsoft Teams delivers signed Bot Framework activities through Azure Bot Service to the Teams Connector Template. The connector does not call Microsoft Graph APIs in v1.
_Avoid_: Graph-based Teams connector, direct Teams API integration

**Workload Identity Deployment**:
The recommended production authentication model where the Teams Connector Template uses a federated identity instead of a long-lived client secret. Client-secret deployment exists as a development or fallback path.
_Avoid_: client-secret-first deployment, embedded bot secret

**Stateless Connector**:
A Teams Connector Template deployment that keeps no durable conversation, replay, or rate-limit state. Kagent owns conversation behavior; replay cache and rate limiting are follow-up hardening concerns.
_Avoid_: Redis-backed bridge, stateful connector

**Boundary Sanitisation**:
Minimal Teams-specific message hygiene performed by the connector before forwarding to or replying from the kagent Agent. It is not a sensitive-data loss-prevention system.
_Avoid_: DLP, agent guardrail, content moderation layer

**Text-first Rendering**:
The Teams Connector Template renders plain text by default. Adaptive Cards are relayed only when kagent exposes an explicit structured response part or artifact with an Adaptive Card content type; arbitrary JSON or Markdown is never inferred to be a card.
_Avoid_: JSON guessing, markdown-to-card conversion, arbitrary card passthrough

**Configurable Mention Rendering**:
An operator-controlled setting that determines whether outbound Teams mention markup from the kagent Agent is stripped before sending to Teams. Stripping is the safer default, but operators may explicitly accept the risk and allow mention rendering.
_Avoid_: mandatory mention stripping, unrestricted mentions by default

**Sensitive Data Guardrail**:
A future kagent-side capability that prevents agents from unintentionally leaking sensitive data through connected channels. It is an important known gap for the Teams Connector Template, but not part of the v1 connector boundary.
_Avoid_: Teams sanitiser, connector-only data protection

**Production Network Policy**:
An optional Kubernetes NetworkPolicy configuration recommended for production deployments of the Teams Connector Template. It is not enabled by default in the upstream template because cluster support for external FQDN egress varies.
_Avoid_: mandatory NetworkPolicy, always-on egress restriction

**Existing Secret Reference**:
A Helm configuration pattern where the operator creates Kubernetes Secrets outside the chart and the Teams Connector Template references them by name and key. The chart does not render Secret resources or accept inline secret values.
_Avoid_: inline Helm secret, chart-managed Secret

## Example dialogue

Developer: “Should the Teams connector include company-specific compliance controls?”

Domain expert: “No. It should be an upstream Teams Connector Template for kagent, with secure defaults and clear guidance for operators that need stricter controls.”

Developer: “Should this live inside kagent core?”

Domain expert: “No. It should be a Standalone Template Repository so it mirrors the existing connector-template model.”

Developer: “Should v1 be Python because existing kagent templates use Python?”

Domain expert: “No. V1 should be a TypeScript Connector because the Teams SDK and A2A support are stable and TS-first.”

Developer: “Does the Teams connector decide which tools are available?”

Domain expert: “No. It is a Pass-through Connector; the kagent Agent decides tool access and performs reasoning.”

Developer: “Should the connector support kagent-initiated Teams notifications?”

Domain expert: “No. It should be a Request-response Connector unless kagent later exposes an outbound event or notification model.”

Developer: “Should one Teams connector deployment route to multiple kagent agents?”

Domain expert: “No. It should be a Single-agent Deployment because different agents may need different settings.”

Developer: “Should the A2A session ID be the raw Teams conversation ID?”

Domain expert: “No. It should be a Hashed Teams Session using the full SHA-256 digest.”

Developer: “Should the connector forward the Teams user identity to kagent?”

Domain expert: “Only through Optional User Forwarding, disabled by default and using a hashed user identifier.”

Developer: “Should the connector work only in personal chats?”

Domain expert: “No. It should support personal, team/channel, and group chat scopes, with Mention-gated Conversation behavior outside personal chats.”

Developer: “Should the Microsoft identity default be multi-tenant for community reach?”

Domain expert: “No. It should be a Single-tenant Connector by default, with multi-tenant documented as an advanced option.”

Developer: “Should the connector call Microsoft Graph to interact with Teams?”

Domain expert: “No. It should use Azure Bot Service Channel only and avoid Graph permissions in v1.”

Developer: “Should the docs lead with a client secret because it is simpler?”

Domain expert: “No. Production docs should lead with Workload Identity Deployment, with client secrets reserved for development or fallback.”

Developer: “Should v1 include a replay cache for Teams activity IDs?”

Domain expert: “No. V1 should remain a Stateless Connector and document replay protection as a follow-up hardening concern.”

Developer: “Can the connector sanitiser prevent sensitive-data leaks?”

Domain expert: “No. Boundary Sanitisation handles Teams-specific hygiene only. Sensitive Data Guardrail belongs on the kagent side and must be documented as an important known gap.”

Developer: “Should the connector turn JSON responses into Adaptive Cards?”

Domain expert: “No. It should use Text-first Rendering and relay Adaptive Cards only through an explicit kagent response contract.”

Developer: “Should outbound Teams mentions always be stripped?”

Domain expert: “No. Use Configurable Mention Rendering: strip by default, but allow operators to enable mention rendering as an explicit risk acceptance.”

Developer: “Should the Helm chart enable NetworkPolicy by default?”

Domain expert: “No. It should provide Production Network Policy as an optional hardening control and strongly recommend it for production.”

Developer: “Should the chart let users put bot secrets directly in values.yaml?”

Domain expert: “No. It should use Existing Secret Reference only and avoid rendering Secret resources.”