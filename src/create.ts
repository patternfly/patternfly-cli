import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { defaultTemplates } from './templates.js';
import { mergeTemplates } from './template-loader.js';
import { offerAndCreateGitHubRepo } from './github.js';

/** Project data provided by the user */
type ProjectData = {
  /** Project name */
  name: string;
  /** Project version */
  version: string;
  /** Project description */
  description: string;
  /** Project author */
  author: string;
};

export type RunCreateOptions = {
  templateFile?: string;
  ssh?: boolean;
};

/**
 * Runs the create flow: clone template, customize package.json, install deps, optionally create GitHub repo.
 * Throws on fatal errors. Caller should catch and process.exit(1).
 */
export async function runCreate(
  projectDirectory: string | undefined,
  templateName: string | undefined,
  options?: RunCreateOptions
): Promise<void> {
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
          value: t.name,
        })),
      },
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
    throw new Error(`Template "${templateName}" not found`);
  }

  const templateRepoUrl = options?.ssh && template.repoSSH ? template.repoSSH : template.repo;

  // Define the full path for the new project (projectDirectory is set above via arg or prompt)
  const dir = projectDirectory ?? 'my-app';
  const projectPath = path.resolve(dir);
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

    const packageManager = template.packageManager || 'npm';
    // Install dependencies
    console.log('📦 Installing dependencies... (This may take a moment)');
    await execa(packageManager, ['install'], { cwd: projectPath, stdio: 'inherit' });
    console.log('✅ Dependencies installed.');

    // Optional: Create GitHub repository (explains what to check if it does not complete)
    await offerAndCreateGitHubRepo(projectPath);

    // Let the user know the project was created successfully
    console.log('\n✨ Project created successfully! ✨\n');
    console.log(`To get started:`);
    console.log(`  cd ${dir}`);
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
    throw error;
  }
}
