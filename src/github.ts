import { execa } from 'execa';

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
 * Create a new GitHub repository and return its URL. Does not push. 
 */
export async function createRepo(options: {
  repoName: string;
  projectPath: string;
  username: string;
  description?: string;
}): Promise<string> {
  const args = [
    'repo', 'create', options.repoName,
    '--public',
    '--source', options.projectPath,
    '--description', options.description || '',
    '--remote', 'origin',
  ];
  await execa('gh', args, { stdio: 'inherit', cwd: options.projectPath });
  return `https://github.com/${options.username}/${options.repoName}.git`;
}
