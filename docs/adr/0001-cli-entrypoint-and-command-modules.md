# 1. CLI entry point and separate command modules

## Status

Accepted

## Context

The PatternFly CLI exposes multiple commands (create, init, list, save, load, deploy, and so on). We need a clear place to register the program with Commander and parse arguments, while keeping each command’s behavior maintainable and easy to test.

## Decision

1. **`src/cli.ts` is the sole main entry point** for the published binary (`package.json` `"main"` / `bin` → compiled `dist/cli.js`). It owns:
   - importing Commander and wiring `program`;
   - registering commands, options, and descriptions;
   - delegating execution to command-specific modules.

2. **Each command’s implementation lives in its own TypeScript file** under `src/` (for example `create.ts`, `save.ts`, `load.ts`, `gh-pages.ts`). Those modules export functions such as `runCreate`, `runSave`, etc., and contain the command’s business logic, side effects, and error handling.

3. **`cli.ts` stays thin**: it should not grow large bodies of domain logic; new or refactored behavior belongs in the appropriate command module (or shared helpers), not inlined in `cli.ts`.

## Consequences

**Positive**

- Easier navigation: contributors find command logic by filename, not inside one long entry file.
- Testing can target command modules with focused imports and mocks.
- Adding a command follows a repeatable pattern: new `src/<command>.ts` + registration in `cli.ts`.

**Negative / trade-offs**

- `cli.ts` must stay in sync when adding or renaming commands (registration + imports).
- Shared cross-command behavior should live in dedicated modules to avoid circular imports between `cli.ts` and command files.

## References

- `src/cli.ts` — program wiring and command registration
- `src/create.ts`, `src/save.ts`, `src/load.ts`, and related modules — command implementations
