#!/usr/bin/env node

import { program } from 'commander';
import { execa } from 'execa';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { defaultTemplates } from './templates.js';
import { mergeTemplates } from './template-loader.js';
import { checkGhAuth, createRepo, repoExists as ghRepoExists, sanitizeRepoName } from './github.js';
import { runSave } from './save.js';

/** Project data provided by the user */
type ProjectData = {
  /** Project name */
  name: string, 
  /** Project version */
  version: string,
  /** Project description */
  description: string,
  /** Project author */
  author: string
}

/** Command to create a new project */
program
  .version('1.0.0')
  .command('create')
  .description('Create a new project from a git template')
  .argument('[project-directory]', 'The directory to create the project in')
  .argument('[template-name]', 'The name of the template to use')
  .option('-t, --template-file <path>', 'Path to a JSON file with custom templates (same format as built-in)')
  .option('--ssh', 'Use SSH URL for cloning the template repository')
  .action(async (projectDirectory, templateName, options) => {
    const templatesToUse = mergeTemplates(defaultTemplates, options?.templateFile);

    // If project directory is not provided, prompt for it
    if (!projectDirectory) {
      const projectDirAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectDirectory',
          message: 'Please provide the directory where you want to create the project?',
          default: 'my-app',
        },
      ]);
      projectDirectory = projectDirAnswer.projectDirectory;
    }

    // If template name is not provided, show available templates and let user select
    if (!templateName) {
      console.log('\n📋 Available templates:\n');
      templatesToUse.forEach(t => {
        console.log(`  ${t.name.padEnd(12)} - ${t.description}`);
      });
      console.log('');
      
      const templateQuestion = [
        {
          type: 'list',
          name: 'templateName',
          message: 'Select a template:',
          choices: templatesToUse.map(t => ({
            name: `${t.name} - ${t.description}`,
            value: t.name
          }))
        }
      ];
      
      const templateAnswer = await inquirer.prompt(templateQuestion);
      templateName = templateAnswer.templateName;
    }
    
    // Look up the template by name
    const template = templatesToUse.find(t => t.name === templateName);
    if (!template) {
      console.error(`❌ Template "${templateName}" not found.\n`);
      console.log('📋 Available templates:\n');
      templatesToUse.forEach(t => {
        console.log(`  ${t.name.padEnd(12)} - ${t.description}`);
      });
      console.log('');
      process.exit(1);
    }

    // If --ssh was not passed, prompt whether to use SSH
    let useSSH = options?.ssh;
    if (useSSH === undefined && template.repoSSH) {
      const sshAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useSSH',
          message: 'Use SSH URL for cloning?',
          default: false,
        },
      ]);
      useSSH = sshAnswer.useSSH;
    }

    const templateRepoUrl = useSSH && template.repoSSH ? template.repoSSH : template.repo;
    
    // Define the full path for the new project
    const projectPath = path.resolve(projectDirectory);
    console.log(`Cloning template "${templateName}" from ${templateRepoUrl} into ${projectPath}...`);

    try {
      
      // Clone the repository
      const cloneArgs = ['clone'];
      if (template.options && Array.isArray(template.options)) {
        cloneArgs.push(...template.options);
      }
      cloneArgs.push(templateRepoUrl, projectPath);
      await execa('git', cloneArgs, { stdio: 'inherit' });
      console.log('✅ Template cloned successfully.');

      // Remove the .git folder from the *new* project
      await fs.remove(path.join(projectPath, '.git'));
      console.log('🧹 Cleaned up template .git directory.');

      // Ask user for customization details
      const questions = [
        {
          type: 'input',
          name: 'name',
          message: 'What is the project name?',
          default: path.basename(projectPath),
        },
        {
          type: 'input',
          name: 'version',
          message: 'What version number would you like to use?',
          default: '1.0.0',
        },
        {
          type: 'input',
          name: 'description',
          message: 'What is the project description?',
          default: '',
        },
        {
          type: 'input',
          name: 'author',
          message: 'Who is the author of the project?',
          default: '',
        },
      ];

      const answers: ProjectData = await inquirer.prompt(questions);

      // Update the package.json in the new project
      const pkgJsonPath = path.join(projectPath, 'package.json');
      
      if (await fs.pathExists(pkgJsonPath)) {
        const pkgJson = await fs.readJson(pkgJsonPath);
        
        // Overwrite fields with user's answers
        pkgJson.name = answers.name;
        pkgJson.version = answers.version;
        pkgJson.description = answers.description;
        pkgJson.author = answers.author;
        
        // Write the updated package.json back
        await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
        console.log('📝 Customized package.json.');
      } else {
        console.log('ℹ️ No package.json found in template, skipping customization.');
      }

      const packageManager = template.packageManager || "npm";
      // Install dependencies
      console.log('📦 Installing dependencies... (This may take a moment)');
      await execa(packageManager, ['install'], { cwd: projectPath, stdio: 'inherit' });
      console.log('✅ Dependencies installed.');

      // Optional: Create GitHub repository
      const { createGitHub } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createGitHub',
          message: 'Would you like to create a GitHub repository for this project?',
          default: false,
        },
      ]);

      if (createGitHub) {
        const auth = await checkGhAuth();
        if (!auth.ok) {
          console.log(`\n⚠️  ${auth.message}`);
          console.log('   Skipping GitHub repository creation.\n');
        } else {
          const pkgJsonForGh = await fs.readJson(pkgJsonPath);
          const projectName = pkgJsonForGh.name as string;
          let repoName = sanitizeRepoName(projectName);

          // If repo already exists, ask for alternative name until we get one that doesn't exist or user skips
          while (await ghRepoExists(auth.username, repoName)) {
            console.log(`\n⚠️  A repository named "${repoName}" already exists on GitHub under your account.\n`);
            const { alternativeName } = await inquirer.prompt([
              {
                type: 'input',
                name: 'alternativeName',
                message: 'Enter an alternative repository name (or leave empty to skip creating a GitHub repository):',
                default: '',
              },
            ]);
            if (!alternativeName?.trim()) {
              repoName = '';
              break;
            }
            repoName = sanitizeRepoName(alternativeName.trim());
          }

          if (repoName) {
            const repoUrl = `https://github.com/${auth.username}/${repoName}`;
            console.log('\n📋 The following will happen:\n');
            console.log(`   • A new public repository will be created at: ${repoUrl}`);
            console.log(`   • The repository will be created under your GitHub account (${auth.username}).`);
            console.log(`   • The repository URL will be added to your package.json.`);
            console.log(`   • The remote "origin" will be set to this repository (you can push when ready).\n`);

            const { confirmCreate } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmCreate',
                message: 'Do you want to proceed with creating this repository?',
                default: true,
              },
            ]);

            if (!confirmCreate) {
              console.log('\n❌ GitHub repository was not created. Your local project is ready at:');
              console.log(`   ${projectPath}\n`);
            } else {
              try {
                const createdUrl = await createRepo({
                  repoName,
                  projectPath,
                  username: auth.username,
                  ...(pkgJsonForGh.description && { description: String(pkgJsonForGh.description) }),
                });
                pkgJsonForGh.repository = { type: 'git', url: createdUrl };
                await fs.writeJson(pkgJsonPath, pkgJsonForGh, { spaces: 2 });
                console.log('\n✅ GitHub repository created successfully!');
                console.log(`   ${repoUrl}`);
                console.log('   Repository URL has been added to your package.json.\n');
              } catch (err) {
                console.error('\n❌ Failed to create GitHub repository:');
                if (err instanceof Error) console.error(`   ${err.message}\n`);
              }
            }
          }
        }
      }

      // Let the user know the project was created successfully
      console.log('\n✨ Project created successfully! ✨\n');
      console.log(`To get started:`);
      console.log(`  cd ${projectDirectory}`);
      console.log('  Happy coding! 🚀');

    } catch (error) {
      console.error('❌ An error occurred:');
      if (error instanceof Error) {
        console.error(error.message);
      } else if (error && typeof error === 'object' && 'stderr' in error) {
        console.error((error as { stderr?: string }).stderr || String(error));
      } else {
        console.error(String(error));
      }
      
      // Clean up the created directory if an error occurred
      if (await fs.pathExists(projectPath)) {
        await fs.remove(projectPath);
        console.log('🧹 Cleaned up failed project directory.');
      }
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

program.parse(process.argv);