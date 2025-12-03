#!/usr/bin/env node

import { program } from 'commander';
import { execa } from 'execa';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import templates from './templates.js';

type ProjectData = {
  name: string,
  version: string,
  description: string,
  author: string
}

program
  .version('1.0.0')
  .command('create')
  .description('Create a new project from a git template')
  .argument('<project-directory>', 'The directory to create the project in')
  .argument('[template-name]', 'The name of the template to use')
  .action(async (projectDirectory, templateName) => {
    
    // If template name is not provided, show available templates and let user select
    if (!templateName) {
      console.log('\n📋 Available templates:\n');
      templates.forEach(t => {
        console.log(`  ${t.name.padEnd(12)} - ${t.description}`);
      });
      console.log('');
      
      const templateQuestion = [
        {
          type: 'list',
          name: 'templateName',
          message: 'Select a template:',
          choices: templates.map(t => ({
            name: `${t.name} - ${t.description}`,
            value: t.name
          }))
        }
      ];
      
      const templateAnswer = await inquirer.prompt(templateQuestion);
      templateName = templateAnswer.templateName;
    }
    
    // Look up the template by name
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      console.error(`❌ Template "${templateName}" not found.\n`);
      console.log('📋 Available templates:\n');
      templates.forEach(t => {
        console.log(`  ${t.name.padEnd(12)} - ${t.description}`);
      });
      console.log('');
      process.exit(1);
    }
    
    const templateRepoUrl = template.repo;
    
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
      await execa('git', cloneArgs);
      console.log('✅ Template cloned successfully.');

      // Remove the .git folder from the *new* project
      await fs.remove(path.join(projectPath, '.git'));
      console.log('🧹 Cleaned up template .git directory.');

      // Ask user for customization details
      const questions = [
        {
          type: 'input',
          name: 'name',
          message: 'Project name?',
          default: path.basename(projectPath),
        },
        {
          type: 'input',
          name: 'version',
          message: 'Version?',
          default: '1.0.0',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description?',
          default: '',
        },
        {
          type: 'input',
          name: 'author',
          message: 'Author?',
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

      // Install dependencies
      console.log('📦 Installing dependencies... (This may take a moment)');
      await execa('npm', ['install'], { cwd: projectPath });
      console.log('✅ Dependencies installed.');

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

program
  .command('list')
  .description('List all available templates')
  .action(() => {
    console.log('\n📋 Available templates:\n');
    templates.forEach(template => {
      console.log(`  ${template.name.padEnd(20)} - ${template.description}`);
    });
    console.log('');
  });

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

program.parse(process.argv);