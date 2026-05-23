# A2A Teams Template

`a2a-teams-template` is a standalone kagent ecosystem template that lets Microsoft Teams users interact with one configured kagent Agent through A2A.

## Documentation map

- `REQUIREMENTS_TRACEABILITY.md` is the managed requirements index. It maps each major requirement area to governing ADRs, glossary terms, implementation seams, tests, validation commands, and roadmap status.
- `CONTEXT.md` defines the repository domain vocabulary.
- `PRODUCT_REQUIREMENTS.md` defines the current product contract, configuration requirements, acceptance criteria, and known gaps.
- `SECURITY_MODEL.md` defines trust boundaries, secure defaults, identity handling, Kubernetes hardening, and security roadmap gaps.
- `DEVELOPMENT_PLAN.md` captures the phased implementation plan and validation checklist.
- `docs/adr/` records accepted architectural decisions.

## Validation quick start

- `npm ci`
- `npm run build`
- `npm test`
- `helm lint helm/a2a-teams-template`
- `helm template helm/a2a-teams-template`

Use `REQUIREMENTS_TRACEABILITY.md` to choose the validation commands relevant to a specific requirement area.