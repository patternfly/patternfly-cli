# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatternFly CLI is a command-line tool for scaffolding PatternFly projects, running codemods, and managing project workflows. It provides interactive commands for creating projects from templates, managing git/GitHub repositories, and deploying to GitHub Pages.

**Key technologies**: TypeScript (ES modules), Commander.js, Inquirer, execa, GitHub CLI

## Build and Development

```bash
# Install dependencies
npm install

# Build TypeScript → dist/
npm run build

# Run tests (Jest with ts-jest)
npm test

# Lint
npm run lint
npm run lint:fix

# Install CLI globally for testing (after building)
npm install -g

# Execute CLI after global install
patternfly-cli [command]
# or
pf [command]
```

## Testing

- Tests live in `src/__tests__/` directories
- Jest configuration in `package.json` with ts-jest preset
- Tests use module mocking for `inquirer`, `fs-extra`, `execa`, and internal modules
- Run specific test: `npm test -- <test-file-name>`
- Test environment is Node.js, with CommonJS transform for compatibility

## Architecture

### Command Structure

Each CLI command is implemented in its own module and orchestrated by `src/cli.ts`:

- **create** (`create.ts`) - Clone a git template, customize package.json, install dependencies, optionally create GitHub repo
- **init** (`github.ts`) - Initialize git repository and create GitHub repository via gh CLI
- **list** (`templates.ts`, `template-loader.ts`) - Display available templates (built-in + custom)
- **save** (`save.ts`) - Interactive git add/commit/push flow with GitHub repo creation if needed
- **load** (`load.ts`) - Pull latest changes from remote
- **deploy** (`gh-pages.ts`) - Build and deploy to GitHub Pages using `gh-pages` library
- **update** (`cli.ts`) - Run PatternFly codemods (`@patternfly/pf-codemods`, `@patternfly/class-name-updater`) via npx
- **cli-upgrade** (`cli.ts`) - Self-update the CLI via npm

### Template System

Templates are defined in `src/templates.ts` with this shape:

```typescript
type Template = {
  name: string;
  description: string;
  repo: string;           // HTTPS clone URL
  repoSSH?: string;       // SSH clone URL (used with --ssh flag)
  options?: string[];     // Extra git clone args (e.g. ["--single-branch", "--branch", "main"])
  packageManager?: string; // npm, yarn, or pnpm
};
```

- Built-in templates in `defaultTemplates` array
- Custom templates can be loaded via `--template-file` (JSON array of Template objects)
- `template-loader.ts` merges custom templates with built-in (custom templates override built-in by name)

### GitHub Integration

- Requires GitHub CLI (`gh`) to be installed and authenticated (`gh auth login`)
- `github.ts` provides:
  - `checkGhAuth()` - Verify gh is installed and user is logged in
  - `repoExists()` - Check if a repo already exists under the user's account
  - `createRepo()` - Create public repo via `gh repo create --push`
  - `offerAndCreateGitHubRepo()` - Interactive flow for creating GitHub repos
  - `sanitizeRepoName()` - Convert package name to valid GitHub repo name
- Automatically sets git remote origin and pushes initial commit
- Used by `create`, `init`, and `save` commands

### Module System

- ES modules (`"type": "module"` in package.json)
- TypeScript config uses `"module": "NodeNext"` and `"moduleResolution": "nodenext"`
- All imports must include `.js` extension (TypeScript verbatim module syntax)
- CLI entry point: `src/cli.ts` (shebang `#!/usr/bin/env node`)

### Dependencies

- **commander** - CLI command parsing and routing
- **inquirer** - Interactive prompts (version 9.x, ESM only)
- **execa** - Process execution wrapper (version 9.x, ESM only)
- **fs-extra** - Enhanced file system operations
- **gh-pages** - Deploy to GitHub Pages branch

## Release Process

Uses semantic-release with conventional commits:

- **Commit format**: `<type>: <description>` (e.g. `feat:`, `fix:`, `BREAKING-CHANGE:`)
- **CI workflow**: `.github/workflows/release.yml` runs on push to `main`
- **Plugins**: commit-analyzer, release-notes-generator, npm, github
- **Outputs**: GitHub release, npm publish (if `NPM_TOKEN` secret is set), version bump, CHANGELOG.md update
- Configuration in `.releaserc.json`

## Code Style

- ESLint with TypeScript ESLint parser (flat config format)
- Extends `@eslint/js` recommended and `typescript-eslint` recommended
- Type checking disabled for test files
- Strict TypeScript settings enabled (see `tsconfig.json`)

## Common Patterns

### Error Handling

Commands in `cli.ts` catch errors from their respective modules and call `process.exit(1)`. Individual modules throw errors for fatal conditions (caller handles exit).

### User Prompts

Use `inquirer.prompt()` for all interactive input. Common patterns:
- Confirm prompts for optional actions
- Input prompts with validation
- List prompts for selecting from options

### Git Operations

Always use `execa('git', [...])` with:
- `cwd` option to specify working directory
- `stdio: 'inherit'` to show output to user
- Try/catch for handling git errors (exit code 128 for auth failures)

### Path Resolution

Use `path.resolve()` for user-provided paths to ensure absolute paths. `process.cwd()` is the default working directory for CLI commands.

## File Locations

- Source: `src/`
- Tests: `src/__tests__/`
- Build output: `dist/` (gitignored)
- Install scripts: `scripts/install.sh`, `scripts/uninstall.sh`
