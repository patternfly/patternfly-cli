import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import inquirer from 'inquirer';

/** 
 * Sanitize a package name for use as a GitHub repository name (alphanumeric, hyphens, underscores) 
 */
export function sanitizeRepoName(name: string): string {
  // Strip npm scope if present (e.g. @scope/package -> package)
  const withoutScope = name.startsWith('@') ? name.slice(name.indexOf('/') + 1) : name;
  // GitHub allows A-Za-z0-9_.- ; replace invalid chars with hyphen and collapse multiple hyphens
  return withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'my-project';
}

/** 
 * Check if GitHub CLI is installed and the user is authenticated 
 */
export async function checkGhAuth(): Promise<{ ok: true; username: string } | { ok: false; message: string }> {
  try {
    await execa('gh', ['auth', 'status'], { reject: true });
  } catch {
    return { ok: false, message: 'GitHub CLI (gh) is not installed or you are not logged in. Install it from https://cli.github.com/ and run "gh auth login".' };
  }
  try {
    const { stdout } = await execa('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8' });
    const username = stdout?.trim();
    if (!username) {
      return { ok: false, message: 'Could not determine your GitHub username.' };
    }
    return { ok: true, username };
  } catch {
    return { ok: false, message: 'Could not fetch your GitHub username. Ensure "gh auth login" has been run.' };
  }
}

/** 
 * Check if a repository already exists for the given owner and repo name 
 */
export async function repoExists(owner: string, repoName: string): Promise<boolean> {
  try {
    await execa('gh', ['api', `repos/${owner}/${repoName}`], { reject: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the project has at least one commit (for push). Idempotent.
 */
async function ensureInitialCommit(projectPath: string): Promise<void> {
  try {
    await execa('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: projectPath,
      reject: true,
    });
  } catch {
    await execa('git', ['add', '.'], { stdio: 'inherit', cwd: projectPath });
    await execa('git', ['commit', '-m', 'Initial commit'], {
      stdio: 'inherit',
      cwd: projectPath,
    });
  }
}

/** 
 * Create a new GitHub repository and return its URL. Does not push. 
 */
export async function createRepo(options: {
  repoName: string;
  projectPath: string;
  username: string;
  description?: string;
  visibility?: 'public' | 'private';
}): Promise<string> {
  const gitDir = path.join(options.projectPath, '.git');
  if (!(await fs.pathExists(gitDir))) {
    await execa('git', ['init'], { stdio: 'inherit', cwd: options.projectPath });
  }
  await ensureInitialCommit(options.projectPath);

  const visibility = options.visibility === 'public' ? '--public' : '--private';
  const args = [
    'repo',
    'create',
    options.repoName,
    visibility,
    `--source=${options.projectPath}`,
    '--remote=origin',
    '--push',
  ];
  if (options.description) {
    args.push(`--description=${options.description}`);
  }
  await execa('gh', args, { stdio: 'inherit', cwd: options.projectPath });
  return `https://github.com/${options.username}/${options.repoName}.git`;
}

/**
 * Interactive flow: prompt to create a GitHub repo under the current user, then create it and set origin.
 * Returns true if a repo was created (or already had origin), false if skipped or failed.
 * @param visibility - 'public' or 'private' (default: 'private')
 */
export async function offerAndCreateGitHubRepo(
  projectPath: string,
  options?: { visibility?: 'public' | 'private' }
): Promise<boolean> {
  const visibility = options?.visibility ?? 'private';
  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (!(await fs.pathExists(pkgJsonPath))) {
    console.log('\nℹ️  No package.json found; skipping GitHub repository creation.\n');
    return false;
  }

  const { createGitHub } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createGitHub',
      message: 'Would you like to create a GitHub repository for this project?',
      default: false,
    },
  ]);

  if (!createGitHub) return false;

  const auth = await checkGhAuth();
  if (!auth.ok) {
    console.log(`\n⚠️  ${auth.message}`);
    console.log('   Skipping GitHub repository creation.\n');
    return false;
  }

  const pkgJson = await fs.readJson(pkgJsonPath);
  const projectName = (pkgJson.name as string) ?? 'my-project';
  let repoName = sanitizeRepoName(projectName);

  while (await repoExists(auth.username, repoName)) {
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

  if (!repoName) return false;

  const repoUrl = `https://github.com/${auth.username}/${repoName}`;
  console.log('\n📋 The following will happen:\n');
  console.log(`   • A new ${visibility} repository will be created at: ${repoUrl}`);
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
    console.log('\n❌ GitHub repository was not created.\n');
    return false;
  }

  try {
    const createdUrl = await createRepo({
      repoName,
      projectPath,
      username: auth.username,
      visibility,
      ...(pkgJson.description && { description: String(pkgJson.description) }),
    });
    pkgJson.repository = { type: 'git', url: createdUrl };
    await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
    console.log('\n✅ GitHub repository created successfully!');
    console.log(`   ${repoUrl}`);
    console.log('   Repository URL has been added to your package.json.\n');
    return true;
  } catch (err) {
    console.error('\n❌ Failed to create GitHub repository:');
    if (err instanceof Error) console.error(`   ${err.message}\n`);
    return false;
  }
}
