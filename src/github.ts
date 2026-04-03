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
    try {
      await execa('git', ['commit', '-m', 'Initial commit'], {
        stdio: 'inherit',
        cwd: projectPath,
      });
    } catch (err) {
      const stderr =
        err && typeof err === 'object' && 'stderr' in err
          ? String((err as { stderr?: unknown }).stderr ?? '')
          : '';
      const msg = err instanceof Error ? err.message : String(err);
      const combined = `${msg}\n${stderr}`;
      const looksLikeIdentityError =
        /author identity unknown|please tell me who you are|unable to auto-detect email address|user\.email is not set|user\.name is not set/i.test(
          combined,
        );
      if (looksLikeIdentityError) {
        throw new Error(
          'Could not create the initial git commit. Set your git identity, then try again:\n' +
            '  git config --global user.name "Your Name"\n' +
            '  git config --global user.email "you@example.com"',
          { cause: err },
        );
      }
      throw err;
    }
  }
}

/**
 * After `create` removes the template `.git`, only a successful GitHub flow adds a repo back.
 * Call this when the user asked for GitHub but setup did not finish.
 */
function logGitHubSetupDidNotComplete(projectPath: string): void {
  const resolved = path.resolve(projectPath);
  console.log('\n⚠️  Git repository setup did not complete.');
  console.log('   The template’s .git directory was removed after clone, so this folder is not a git repo yet.\n');
  console.log('   Check:');
  console.log('   • GitHub CLI: `gh auth status` — if not logged in, run `gh auth login`');
  console.log('   • Network and API errors above (permissions, repo name already exists, etc.)');
  console.log(
    '   • Your git user.name and/or user.email may not be set. Run `patternfly-cli init --git-init` in the project directory to set local git identity and try again.',
  );
  console.log(`\n   Project path: ${resolved}\n`);
}

/**
 * Create a new GitHub repository and return its URL. Pushes the current branch via `gh repo create --push`.
 */
export async function createRepo(options: {
  repoName: string;
  projectPath: string;
  username: string;
  description?: string;
}): Promise<string> {
  const gitDir = path.join(options.projectPath, '.git');
  if (!(await fs.pathExists(gitDir))) {
    await execa('git', ['init'], { stdio: 'inherit', cwd: options.projectPath });
  }
  await ensureInitialCommit(options.projectPath);

  const args = [
    'repo',
    'create',
    options.repoName,
    '--public',
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
 */
export async function offerAndCreateGitHubRepo(projectPath: string): Promise<boolean> {
  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (!(await fs.pathExists(pkgJsonPath))) {
    console.log('\nℹ️  No package.json found; skipping GitHub repository creation.\n');
    return false;
  }

  const { createGitHub } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createGitHub',
      message:
        'Would you like to create a GitHub repository for this project? (requires GitHub CLI and gh auth login)',
      default: false,
    },
  ]);

  if (!createGitHub) return false;

  const auth = await checkGhAuth();
  if (!auth.ok) {
    console.log(`\n⚠️  ${auth.message}`);
    console.log('   Skipping GitHub repository creation.');
    logGitHubSetupDidNotComplete(projectPath);
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

  if (!repoName) {
    logGitHubSetupDidNotComplete(projectPath);
    return false;
  }

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
    console.log('\n❌ GitHub repository was not created.');
    logGitHubSetupDidNotComplete(projectPath);
    return false;
  }

  try {
    const createdUrl = await createRepo({
      repoName,
      projectPath,
      username: auth.username,
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
    if (err instanceof Error) console.error(`   ${err.message}`);
    logGitHubSetupDidNotComplete(projectPath);
    return false;
  }
}
