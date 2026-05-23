# Standalone TypeScript pass-through connector

Status: accepted

The Teams integration will be built as a standalone `a2a-teams-template` repository rather than a patch to kagent core. The initial implementation will use TypeScript because the Microsoft Teams SDK and A2A client support are stable and TypeScript-first, while the connector itself remains a pass-through adapter with no local LLM, tool routing, or agent policy.

## Considered options

- Patch kagent core: rejected to preserve the existing connector-template contribution model.
- Python: rejected for v1 because Teams SDK support was identified as preview.
- C#/.NET: rejected for v1 because it is heavier and less aligned with kagent's lightweight connector templates.

## Consequences

- The repo may differ from existing Python templates, but the difference is justified by SDK maturity.
- kagent owns reasoning and tools; the connector owns Teams transport behavior only.