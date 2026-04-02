#!/usr/bin/env node

import { program } from 'commander';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defaultTemplates } from './templates.js';
import { mergeTemplates } from './template-loader.js';
import { offerAndCreateGitHubRepo } from './github.js';
import { runCreate } from './create.js';
import { runSave } from './save.js';
import { runLoad } from './load.js';
import { runDeployToGitHubPages } from './gh-pages.js';
import { readPackageVersion } from './read-package-version.js';
import { promptAndSetLocalGitUser } from './git-user-config.js';

const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const packageVersion = readPackageVersion(packageJsonPath);

/** Command to create a new project */
program
  .version(packageVersion)
  .command('create')
  .description('Create a new project from a git template')
  .argument('[project-directory]', 'The directory to create the project in')
  .argument('[template-name]', 'The name of the template to use')
  .option('-t, --template-file <path>', 'Path to a JSON file with custom templates (same format as built-in)')
  .option('--ssh', 'Use SSH URL for cloning the template repository')
  .action(async (projectDirectory, templateName, options) => {
    try {
      await runCreate(projectDirectory, templateName, {
        templateFile: options?.templateFile,
        ssh: options?.ssh,
      });
    } catch {
      process.exit(1);
    }
  });

/** Command to initialize a project and optionally create a GitHub repository */
program
  .command('init')
  .description('Initialize the current directory (or path) as a git repo and optionally create a GitHub repository')
  .argument('[path]', 'Path to the project directory (defaults to current directory)')
  .option('--git-init', 'Prompt for git user.name and user.email and store them locally for this repository')
  .action(async (dirPath, options) => {
    try {
      const cwd = dirPath ? path.resolve(dirPath) : process.cwd();
      const gitDir = path.join(cwd, '.git');
      if (!(await fs.pathExists(gitDir))) {
        await execa('git', ['init'], { stdio: 'inherit', cwd });
        console.log('✅ Git repository initialized.\n');
      }
      if (options.gitInit) {
        await promptAndSetLocalGitUser(cwd);
      }
      await offerAndCreateGitHubRepo(cwd);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\n❌ ${error.message}\n`);
      } else {
        console.error(error);
      }
      process.exit(1);
    }
  });

/** Command to list all available templates */
program
  .command('list')
  .description('List all available templates')
  .option('--verbose', 'List all available templates with verbose information')
  .option('-t, --template-file <path>', 'Include templates from a JSON file (same format as built-in)')
  .action((options) => {
    const templatesToUse = mergeTemplates(defaultTemplates, options?.templateFile);
    console.log('\n📋 Available templates:\n');
    templatesToUse.forEach(template => {
      console.log(`  ${template.name.padEnd(20)} - ${template.description}`)
      if (options.verbose) {
        console.log(`    Repo URL: ${template.repo}`);
        if (template.options && Array.isArray(template.options)) {
          console.log(`    Checkout Options: ${template.options.join(', ')}`);
        }
      }
    });
    console.log('');
  });

const PACKAGE_NAME = '@patternfly/patternfly-cli';

/** Update this CLI to the latest published npm version */
program
  .command('cli-upgrade')
  .description('Upgrade patternfly-cli to the latest version (npm global install)')
  .action(async () => {
    console.log(`Installing latest ${PACKAGE_NAME}...\n`);
    try {
      await execa('npm', ['install', '-g', `${PACKAGE_NAME}@latest`], { stdio: 'inherit' });
      console.log('\n✅ patternfly-cli is up to date.');
    } catch {
      console.error(
        '\n❌ Could not upgrade patternfly-cli. If you use another global package manager, run the equivalent of:',
        `\n   npm install -g ${PACKAGE_NAME}@latest\n`,
      );
      process.exit(1);
    }
  });

/** Command to run PatternFly codemods on a directory */
program
  .command('update')
  .description('Run PatternFly codemods on a directory to transform code to the latest PatternFly patterns')
  .argument('[path]', 'The path to the source directory to run codemods on (defaults to "src")')
  .option('--fix', 'Automatically apply fixes to files instead of just showing what would be changed')
  .action(async (srcPath, options) => {
    const targetPath = srcPath || 'src';
    const resolvedPath = path.resolve(targetPath);
    const commands = ['@patternfly/pf-codemods', '@patternfly/class-name-updater'];
    
    console.log(`Running PatternFly updates on ${resolvedPath}...`);

    for (const command of commands) {
      try {
        console.log(`\n📦 Running ${command}...`);
        const args = [command];
        if (options.fix) {
          args.push('--fix');
        }
        args.push(resolvedPath);
        await execa('npx', args, { stdio: 'inherit' });
        console.log(`✅ ${command} completed successfully.`);
      } catch (error) {
        console.error(`❌ An error occurred while running ${command}:`);
        if (error instanceof Error) {
          console.error(error.message);
        } else if (error && typeof error === 'object' && 'stderr' in error) {
          console.error((error as { stderr?: string }).stderr || String(error));
        } else {
          console.error(String(error));
        }
        process.exit(1);
      }
    }
    
    console.log('\n✨ All updates completed successfully! ✨');
  });

/** Command to save changes: check for changes, prompt to commit, and push */
program
  .command('save')
  .description('Check for changes, optionally commit them with a message, and push to the current branch')
  .argument('[path]', 'Path to the repository (defaults to current directory)')
  .action(async (repoPath) => {
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    try {
      await runSave(cwd);
    } catch {
      process.exit(1);
    }
  });

/** Command to load latest updates from the remote */
program
  .command('load')
  .description('Pull the latest updates from GitHub')
  .argument('[path]', 'Path to the repository (defaults to current directory)')
  .action(async (repoPath) => {
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    try {
      await runLoad(cwd);
    } catch {
      process.exit(1);
    }
  });

/** Command to deploy the React app to GitHub Pages */
program
  .command('deploy')
  .description('Build the app and deploy it to GitHub Pages (uses gh-pages branch)')
  .argument('[path]', 'Path to the project (defaults to current directory)')
  .option('-d, --dist-dir <dir>', 'Build output directory to deploy', 'dist')
  .option('--no-build', 'Skip running the build step (deploy existing output only)')
  .option('-b, --branch <branch>', 'Git branch to deploy to', 'gh-pages')
  .option(
    '--base <path>',
    'Public URL path for assets (default: /<repo>/ from git origin, or / for <user>.github.io repos)'
  )
  .action(async (projectPath, options) => {
    const cwd = projectPath ? path.resolve(projectPath) : process.cwd();
    try {
      await runDeployToGitHubPages(cwd, {
        distDir: options.distDir,
        skipBuild: options.build === false,
        branch: options.branch,
        basePath: options.base,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\n❌ ${error.message}\n`);
      } else {
        console.error(error);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);