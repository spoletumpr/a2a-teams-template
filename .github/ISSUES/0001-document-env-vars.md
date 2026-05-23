---
title: Document environment variables and provide example `.env`
labels: documentation
---

## Summary

The repository lacks an explicit document describing required environment variables, their purpose, and example values. This causes onboarding friction and misconfiguration risk.

## Tasks

- Add `/.env.example` with commented placeholders.
- Add `docs/CONFIGURATION.md` listing variables, defaults, and security guidance.
- Update `README.md` to reference the new docs and example file.

## Resolution

Status: Closed — implemented in-tree.

Files added:

- `/.env.example`
- `docs/CONFIGURATION.md`
- Updated `README.md` to include a Configuration section.
