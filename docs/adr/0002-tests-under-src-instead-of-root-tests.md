# 2. Tests under `src/__tests__` instead of a root `tests/` directory

## Status

Accepted

## Context

Node and TypeScript projects often place tests in a top-level `tests/` or `test/` folder. Some automated readiness heuristics assume that layout. This repository already uses Jest with files under `src/__tests__/`, co-located next to the modules they exercise.

## Decision

1. **Jest tests and fixtures live under `src/__tests__/`** (for example `src/__tests__/create.test.ts`, `src/__tests__/fixtures/`). We **do not** use a root-level `tests/` directory for this package.

2. **Rationale for co-location**
   - Imports from tests to implementation stay short and stable (`../create.js`-style paths mirror the source tree).
   - `tsconfig.json` can target production code under `src/` while excluding `*.test.ts` from the emit graph without maintaining a second top-level source tree.

3. **Tooling alignment**: `package.json` Jest `testMatch` and scripts assume `**/__tests__/**/*.test.ts`. New suites should follow that layout.

## Consequences

**Positive**

- Clear mapping from a feature file in `src/` to its tests in `src/__tests__/`.
- No duplicate “package root” for TypeScript sources vs tests.

**Negative / trade-offs**

- Tools or scores that only look for `./tests` at the repository root will not see our layout; contributors should rely on this ADR and `AGENTS.md` for the canonical rule.

## References

- `package.json` — `jest.testMatch`
- `src/__tests__/` — test suites and `fixtures/`
