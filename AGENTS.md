# Agent context: PatternFly CLI

This repository is **`@patternfly/patternfly-cli`**: a Node.js CLI for scaffolding projects from git templates, git/GitHub helpers, and GitHub Pages deploy. Published binaries: `patternfly-cli` and `pfcli`.

## Tech stack

- **Runtime**: Node.js 20–24 (CI uses 22).
- **Language**: TypeScript, **ES modules** (`"type": "module"`). Source uses `.js` extensions in import paths (Node ESM).
- **CLI**: [Commander](https://github.com/tj/commander.js).
- **Process / git**: [execa](https://github.com/sindresorhus/execa), [fs-extra](https://github.com/jprichardson/node-fs-extra), [inquirer](https://github.com/SBoudrias/Inquirer.js).
- **Tests**: Jest + ts-jest; tests live under `src/__tests__/**/*.test.ts`.
- **Lint**: ESLint flat config — `eslint.config.js`, scope `src/`.

## Repository layout

| Path | Role |
|------|------|
| `src/cli.ts` | **Main entry** — Commander wiring only; see [ADR 0001](docs/adr/0001-cli-entrypoint-and-command-modules.md) |
| `src/create.ts`, `src/save.ts`, `src/load.ts`, … | **Command modules** — one file per command’s implementation |
| `src/templates.ts`, `src/template-loader.ts` | Built-in templates and merge with `--template-file` |
| `src/github.ts`, `src/gh-pages.ts`, `src/git-user-config.ts` | GitHub / git / Pages |
| `src/__tests__/` | Jest tests and fixtures — **not** a root `tests/` folder; see [ADR 0002](docs/adr/0002-tests-under-src-instead-of-root-tests.md) |
| `dist/` | **Build output** — do not hand-edit; produced by `tsc` |
| `scripts/install.sh`, `scripts/uninstall.sh` | User-facing install helpers (not part of npm package build) |

## Pattern references

`src/cli.ts` is only the **entry point**; each command’s logic lives in a **separate** module. When adding or changing behavior, **follow the pattern** in these files instead of growing `cli.ts`:

- **New or changed “create from template” flow** — follow the pattern in `src/create.ts`; register the command in `src/cli.ts` only.
- **Commit / push workflow** — see `src/save.ts` for how the command delegates to git and GitHub helpers.
- **Pull / sync workflow** — see `src/load.ts` for the same style of orchestration and error handling.
- **GitHub Pages deploy** — see `src/gh-pages.ts` for a reference implementation that wraps side-effectful steps.
- **Init / repo creation prompts** — use `src/github.ts` and `src/git-user-config.ts` as templates for interactive git and GitHub flows.

Use `src/create.ts` as a **reference implementation** when you need a full example of a `run*` export wired from `cli.ts`.

## Commands (local development)

From the repo root:

```bash
npm ci          # preferred in CI / clean installs
npm install     # local dev

npm run build   # compile TypeScript → dist/
npm test        # Jest
npm run lint    # ESLint on src/
npm run lint:fix
```

### Single-file verification

After changing a source or test file, you can verify **just that file** (plus what ESLint’s type-aware project service needs) without scanning the whole tree for lint, and run **one** test file when relevant:

```bash
# Lint one module (paths after `--`)
npm run lint:file -- src/create.ts

# Types for the whole program graph (tsc does not support true one-file compile in this repo)
npm run typecheck

# One Jest file
npm run test:file -- src/__tests__/create.test.ts
```

Use **`lint:file` + `test:file`** when you touched implementation and its test; use **`typecheck`** when you need a full TypeScript check without writing `dist/`.

Run the built CLI without global install:

```bash
npm run build && node dist/cli.js --help
```

Release tooling: **semantic-release** with **Conventional Commits** (see README “Releasing”). Dry run: `npx semantic-release --dry-run`.

### Commits

- **Commitlint** (`commitlint.config.mjs`) uses `@commitlint/config-conventional`. After `npm install`, **Husky** runs `commitlint` on `commit-msg` so invalid messages are blocked locally.
- On **pull requests**, CI runs `commitlint` over the commit range against the base branch.

## CI

- **CI** (`ci.yml`): on push and pull request to `main` — **lint**, **build**, **test** after `npm ci`; on pull requests only, a **Conventional Commits** job validates commit messages.
- **Release** (`release.yml`): on push to `main` — `npm ci`, lint, build, test, then semantic-release.

## GitHub templates

Issue forms live under **`.github/ISSUE_TEMPLATE/`**; the default PR template is **`.github/pull_request_template.md`**.

## AgentReady and cyclomatic complexity

**Cyclomatic complexity** is a rough count of independent paths through a function (branches, loops, `catch`, `?:`, etc.). Higher numbers usually mean code is harder to test and to reason about; many teams keep functions small and shallow to stay under common thresholds (for example average CCN under ~10).

[AgentReady](https://github.com/ambient-code/agentready) can call the Python tool [**lizard**](https://github.com/terryyin/lizard) for TypeScript/JavaScript. This repo does **not** add Python to the Node toolchain, so that check is often **skipped** when `lizard` is not on your `PATH`.

- **Recommended assessment command** (uses repo config):

  ```bash
  agentready assess -c .agentready-config.yaml .
  ```

  **`.agentready-config.yaml`** excludes **`cyclomatic_complexity`** (no Python `lizard` in the Node toolchain) and **`standard_layout`** (AgentReady expects `./tests`; we use **`src/__tests__/`** per [ADR 0002](docs/adr/0002-tests-under-src-instead-of-root-tests.md)). We still rely on **ESLint**, **tests**, and review for quality.

- **Optional** — run lizard yourself after `pip install lizard`:

  ```bash
  lizard src
  ```

## Conventions for changes

- Prefer **small, focused** changes; match existing style (imports, error handling, Commander patterns).
- **Typecheck** is via `tsc` through `npm run build`; `tsconfig.json` uses strict options — keep types honest.
- New behavior should have **tests** in `src/__tests__/` when feasible; use existing fixtures under `src/__tests__/fixtures/` as patterns.
- Do not expand scope into unrelated refactors or new docs unless requested.

## User-facing docs

End-user install, commands, custom templates, and prerequisites are in **`README.md`**. Keep `AGENTS.md` aimed at contributors and coding agents; avoid duplicating long user docs here.
