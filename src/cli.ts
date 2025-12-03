#!/usr/bin/env node

import { program } from 'commander';
import { execa } from 'execa';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';

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
  .argument('<template-repo-url>', 'The URL of the template repository to clone')
  .action(async (templateRepoUrl, projectDirectory) => {
    
    // 1. Define the full path for the new project
    const projectPath = path.resolve(projectDirectory);
    console.log(`Cloning template from ${templateRepoUrl} into ${projectPath}...`);

    try {
      
      // 2. Clone the repository
      await execa('git', ['clone', templateRepoUrl, projectPath]);
      console.log('✅ Template cloned successfully.');

      // 3. Remove the .git folder from the *new* project
      await fs.remove(path.join(projectPath, '.git'));
      console.log('🧹 Cleaned up template .git directory.');

      // 4. Ask user for customization details
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

      // 5. Update the package.json in the new project
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

      // 6. Install dependencies
      console.log('📦 Installing dependencies... (This may take a moment)');
      await execa('npm', ['install'], { cwd: projectPath });
      console.log('✅ Dependencies installed.');

      // 7. Final message
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
  .command('codemod')
  .description('Run PatternFly codemods on a directory to transform code to the latest PatternFly patterns')
  .argument('[path]', 'The path to the source directory to run codemods on (defaults to "src")')
  .option('--fix', 'Automatically apply fixes to files instead of just showing what would be changed')
  .action(async (srcPath, options) => {
    const targetPath = srcPath || 'src';
    const resolvedPath = path.resolve(targetPath);
    console.log(`Running PatternFly codemods on ${resolvedPath}...`);

    try {
      const args = ['@patternfly/pf-codemods'];
      if (options.fix) {
        args.push('--fix');
      }
      args.push(resolvedPath);
      await execa('npx', args, { stdio: 'inherit' });
      console.log('✅ Codemods completed successfully.');
    } catch (error) {
      console.error('❌ An error occurred while running codemods:');
      if (error instanceof Error) {
        console.error(error.message);
      } else if (error && typeof error === 'object' && 'stderr' in error) {
        console.error((error as { stderr?: string }).stderr || String(error));
      } else {
        console.error(String(error));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);