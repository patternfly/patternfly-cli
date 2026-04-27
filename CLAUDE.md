# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatternFly CLI (`@patternfly/patternfly-cli`) is a command-line tool for scaffolding PatternFly projects, running
codemods, and managing git/GitHub workflows. It can be invoked as `patternfly-cli` or the shorter alias `pf`.

**Key capabilities:**

- Scaffold new projects from git templates (built-in or custom)
- Run PatternFly codemods to update existing code
- Manage git/GitHub workflows (init, save, load, deploy to GitHub Pages)
- Self-upgrade to the latest npm release

## Development Commands

### Build and Test

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm test             # Run all Jest tests
npm run lint         # Lint with ESLint
npm run lint:fix     # Auto-fix linting issues
```

### Run a Single Test

```bash
npx jest <test-file-pattern>
# Example:
npx jest create.test.ts
npx jest tests/github.test.ts
```

### Local Development

After building, install the CLI globally to test changes:

```bash
npm run build
npm install -g
# Now 'patternfly-cli' or 'pf' runs your local build
```

## Architecture

### Module System

- **TypeScript with ESM modules** using `"type": "module"` and `"module": "NodeNext"`
- **Import paths must include `.js` extensions** even for `.ts` files (e.g., `import { foo } from './bar.js'`).
  This is required by NodeNext module resolution.
- **Tests use ts-jest** with custom `moduleNameMapper` to handle ESM imports

### Command Structure

The entry point ([src/cli.ts](src/cli.ts)) defines all CLI commands using Commander.js. Each command delegates to a
dedicated module:

- `create` → [src/create.ts](src/create.ts) - Clone git template, customize package.json, install deps
- `init` → [src/github.ts](src/github.ts) - Initialize git repo and optionally create GitHub repo
- `update` → [src/cli.ts](src/cli.ts) - Run `@patternfly/pf-codemods` and `@patternfly/class-name-updater` via npx
- `save` → [src/save.ts](src/save.ts) - Commit and push changes
- `load` → [src/load.ts](src/load.ts) - Pull latest from remote
- `deploy` → [src/gh-pages.ts](src/gh-pages.ts) - Build and deploy to GitHub Pages

### Template System

- **Built-in templates** are defined in [src/templates.ts](src/templates.ts) as an array of `Template` objects
- **Custom templates** can be loaded from JSON files via `--template-file` / `-t` option
- **Template merging** ([src/template-loader.ts](src/template-loader.ts)) allows custom templates to override
  built-in ones by name
- Each `Template` specifies:
  - `name`, `description` (required)
  - `repo` (HTTPS URL) and optional `repoSSH` (SSH URL)
  - `options` (git clone flags like `["--single-branch", "--branch", "main"]`)
  - `packageManager` (`npm`, `yarn`, or `pnpm`)

### Git/GitHub Integration

- [src/github.ts](src/github.ts) handles GitHub repo creation via `gh` CLI
- [src/git-user-config.ts](src/git-user-config.ts) prompts for local git user.name/user.email
- Commands use `execa` to run git and gh commands with proper error handling

## TypeScript Configuration

The project uses **strict TypeScript settings** ([tsconfig.json](tsconfig.json)):

- `strict: true` with additional strictness (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- `noImplicitAny: false` to allow some implicit any (only exception to strict mode)
- `verbatimModuleSyntax: true` requires explicit `type` imports for type-only imports
- `isolatedModules: true` ensures each file can be transpiled independently

## Testing

- Tests live in [tests/](tests/) at the project root with `.test.ts` suffix
- Uses **ts-jest** with custom configuration for ESM compatibility
- Test files import from `../src/` (e.g., `import { runCreate } from '../src/create.js'`)
- Mock setup for `execa` is in [**mocks**/execa.js](__mocks__/execa.js)
- Test fixtures (sample package.json files, etc.) are in [tests/fixtures/](tests/fixtures/)

## Release Process

Uses **semantic-release** with conventional commits:

- Pushing to `main` triggers automated release workflow (GitHub Actions)
- Commit message prefixes determine version bump:
  - `feat:` → minor version bump
  - `fix:` → patch version bump
  - `BREAKING CHANGE:` → major version bump
- Updates `CHANGELOG.md`, creates GitHub release, bumps `package.json` version
- npm publishing is controlled by `.releaserc.json` (requires `NPM_TOKEN` secret)

## Code Style Guidelines

- Use **async/await** for asynchronous operations
- **Error handling**: catch errors, log with `console.error()`, and `throw` (or `process.exit(1)` for CLI commands)
- **User feedback**: use emoji prefixes for console output (✅ success, ❌ error, 📦 info, etc.)
- **Inquirer prompts** for interactive user input (project name, template selection, etc.)
- **Type safety**: prefer explicit types over `any`, use `unknown` for truly unknown data

## Important Patterns

### ESM Import Extensions

Always use `.js` extensions in imports, even when importing from `.ts` files:

```typescript
import { runCreate } from './create.js';  // Correct
import { runCreate } from './create';     // Will not work
```

### Template Validation

Custom template files must be validated ([src/template-loader.ts](src/template-loader.ts:6-72)):

- Must be valid JSON array
- Each template must have `name`, `description`, and `repo` as non-empty strings
- Optional fields (`repoSSH`, `options`, `packageManager`) have specific type requirements

### Git Clone with Options

Templates can specify git clone options (e.g., for specific branches):

```typescript
const cloneArgs = ['clone'];
if (template.options && Array.isArray(template.options)) {
  cloneArgs.push(...template.options);
}
cloneArgs.push(templateRepoUrl, projectPath);
await execa('git', cloneArgs, { stdio: 'inherit' });
```

### Cleanup on Failure

When operations fail mid-execution (e.g., during `create`), clean up partial state:

```typescript
if (await fs.pathExists(projectPath)) {
  await fs.remove(projectPath);
  console.log('🧹 Cleaned up failed project directory.');
}
```
