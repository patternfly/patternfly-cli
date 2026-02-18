import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { defaultTemplates } from './templates.js';
import { mergeTemplates } from './template-loader.js';
import { offerAndCreateGitHubRepo } from './github.js';

/** Project data provided by the user */
type ProjectData = {
  name: string;
  version: string;
  description: string;
  author: string;
};

export type CreateOptions = {
  templateFile?: string;
  ssh?: boolean;
};

/**
 * Runs the create flow: prompt for directory/template if needed, clone template,
 * customize package.json, install deps, optionally create GitHub repo.
 */
export async function runCreate(
  projectDirectory: string | undefined,
  templateName: string | undefined,
  options?: CreateOptions
): Promise<void> {
  const templatesToUse = mergeTemplates(defaultTemplates, options?.templateFile);

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

  const useSSH = options?.ssh ?? false;
  const templateRepoUrl = useSSH && template.repoSSH ? template.repoSSH : template.repo;

  const dir = projectDirectory as string;
  const projectPath = path.resolve(dir);
  console.log(`Cloning template "${templateName}" from ${templateRepoUrl} into ${projectPath}...`);

  try {
    const cloneArgs = ['clone'];
    if (template.options && Array.isArray(template.options)) {
      cloneArgs.push(...template.options);
    }
    cloneArgs.push(templateRepoUrl, projectPath);
    await execa('git', cloneArgs, { stdio: 'inherit' });
    console.log('✅ Template cloned successfully.');

    await fs.remove(path.join(projectPath, '.git'));
    console.log('🧹 Cleaned up template .git directory.');

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

    const pkgJsonPath = path.join(projectPath, 'package.json');

    if (await fs.pathExists(pkgJsonPath)) {
      const pkgJson = await fs.readJson(pkgJsonPath);

      pkgJson.name = answers.name;
      pkgJson.version = answers.version;
      pkgJson.description = answers.description;
      pkgJson.author = answers.author;

      await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
      console.log('📝 Customized package.json.');
    } else {
      console.log('ℹ️ No package.json found in template, skipping customization.');
    }

    const packageManager = template.packageManager || 'npm';
    console.log('📦 Installing dependencies... (This may take a moment)');
    await execa(packageManager, ['install'], { cwd: projectPath, stdio: 'inherit' });
    console.log('✅ Dependencies installed.');

    await offerAndCreateGitHubRepo(projectPath);

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

    if (await fs.pathExists(projectPath)) {
      await fs.remove(projectPath);
      console.log('🧹 Cleaned up failed project directory.');
    }
    throw error;
  }
}
