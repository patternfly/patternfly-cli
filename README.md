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

## Usage

After installation, you can use the CLI by running:

```sh
patternfly-cli [command]
```

### Available Commands

- **`create`**: Create a new project from the available templates.
- **`list`**: List all available templates (built-in and optional custom).
- **`update`**: Update your project to a newer version.

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

After that you can now execute the cli via ```patternfly-cli``` command in the terminal. We are currently in the process of moving this to npmjs once we this ready for v 1.0.0
