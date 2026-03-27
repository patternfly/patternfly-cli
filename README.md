# Patternfly CLI

Patternfly CLI is a command-line tool designed for scaffolding projects, performing code modifications, and running project-related tasks. It aims to streamline development workflows and improve productivity.

## Features

- **Project Scaffolding**: Quickly set up new projects with predefined templates.
- **Code Modifications**: Automate repetitive code changes.
- **Task Runner**: Execute project-related tasks efficiently.

## Installation

To install the CLI globally, use npm:

```sh
npm install -g patternfly-cli
```

## Prerequisites

Before using the Patternfly CLI, install the following:

- **Node.js and npm** (v20–24) — [npm](https://www.npmjs.com/) · [Node.js downloads](https://nodejs.org/)
- **Corepack** — enable with `corepack enable` (included with Node.js). Run the command after installing npm.
- **GitHub CLI** — [Install GitHub CLI](https://cli.github.com/)
  
## Usage

After installation, you can use the CLI by running:

```sh
patternfly-cli [command]
```

### Available Commands

- **`doctor`**: Check if all requirements are installed and optionally fix them.
- **`create`**: Create a new project from the available templates.
- **`list`**: List all available templates (built-in and optional custom).
- **`update`**: Update your project to a newer version.
- **`init`**: Initialize a git repository and optionally create a GitHub repository.
- **`save`**: Commit and push changes to the current branch.
- **`load`**: Pull the latest updates from GitHub.
- **`deploy`**: Build and deploy your app to GitHub Pages.

### Doctor Command

The `doctor` command checks if all requirements are met to use Patternfly CLI:

```sh
patternfly-cli doctor
```

This will check for:
- Node.js version >= 20
- Corepack enabled
- GitHub CLI installed

To automatically fix any missing requirements, use the `--fix` flag:

```sh
patternfly-cli doctor --fix
```

The `--fix` flag will:
- Enable corepack if it's not already enabled
- Install GitHub CLI using the appropriate package manager for your OS:
  - macOS: Homebrew (`brew install gh`)
  - Linux (Debian/Ubuntu): apt (`sudo apt install gh`)
  - Linux (Fedora/RHEL): dnf (`sudo dnf install gh`)
  - Windows: winget (`winget install --id GitHub.cli`)

**Important Note about Node.js:** The `doctor` command **cannot** automatically install or update Node.js. If your Node.js version is below 20 or Node.js is not installed, you must manually download and install it from [https://nodejs.org/](https://nodejs.org/). We recommend installing the **LTS (Long Term Support)** version.

### Custom templates

You can add your own templates in addition to the built-in ones by passing a JSON file with the `--template-file` (or `-t`) option. Custom templates are merged with the built-in list; if a custom template has the same `name` as a built-in one, the custom definition is used.

**Create with custom templates:**

```sh
patternfly-cli create my-app --template-file ./my-templates.json
```

**List templates including custom file:**

```sh
patternfly-cli list --template-file ./my-templates.json
```

**JSON format** (array of template objects, same shape as the built-in templates):

```json
[
  {
    "name": "my-template",
    "description": "My custom project template",
    "repo": "https://github.com/org/repo.git",
    "options": ["--single-branch", "--branch", "main"],
    "packageManager": "npm"
  }
]
```

- **`name`** (required): Template identifier.
- **`description`** (required): Short description shown in prompts and `list`.
- **`repo`** (required): Git clone URL.
- **`options`** (optional): Array of extra arguments for `git clone` (e.g. `["--single-branch", "--branch", "main"]`).
- **`packageManager`** (optional): `npm`, `yarn`, or `pnpm`; defaults to `npm` if omitted.


## Development / Installation

### Install Dependencies

```sh
npm install
```

### Build

To build the project, run:

```sh
npm run build
```

### Installing the cli

After building the cli you can install the cli globally by running the following command:

```sh
npm install -g
```

After that you can now execute the cli via ```patternfly-cli``` command in the terminal.

### Releasing

This project uses [semantic-release](https://semantic-release.gitbook.io/) to automate versioning and releases based on [Conventional Commits](https://www.conventionalcommits.org/).

- **CI**: Pushing to `main` runs the release workflow. If there are commits that warrant a release (e.g. `feat:`, `fix:`, `BREAKING CHANGE:`), it will create a GitHub release, update `CHANGELOG.md`, and bump the version in `package.json`.
- **Local dry run**: `npx semantic-release --dry-run` (no push or publish).
- **npm publish**: By default only GitHub releases are created. To publish to npm, set the `NPM_TOKEN` secret in the repo and set `"npmPublish": true` for the `@semantic-release/npm` plugin in `.releaserc.json`.
