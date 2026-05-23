# Text-first rendering and explicit card contract

Status: accepted

The connector renders plain text by default and does not infer Adaptive Cards from arbitrary JSON or Markdown. Adaptive Cards may be relayed only if kagent exposes an explicit typed A2A response part or artifact with an Adaptive Card content type.

## Consequences

- If kagent has no documented card artifact contract, v1 implements text-only rendering.
- The adapter may later add a small attachment-rendering branch once the kagent contract is explicit.
- Arbitrary JSON from an agent is never treated as trusted Teams card content.