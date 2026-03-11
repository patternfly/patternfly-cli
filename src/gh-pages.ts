import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import ghPages from 'gh-pages';
import { checkGhAuth } from './github.js';

export type DeployOptions = {
  /** Build output directory to deploy (e.g. dist, build) */
  distDir: string;
  /** Skip running the build step */
  skipBuild: boolean;
  /** Branch to push to (default gh-pages) */
  branch: string;
};

const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_BRANCH = 'gh-pages';

/**
 * Parse owner and repo name from a Git remote URL.
 * Supports https://github.com/owner/repo, https://github.com/owner/repo.git, git@github.com:owner/repo.git
 */
function parseRepoFromUrl(repoUrl: string): { owner: string; repo: string } | null {
  const trimmed = repoUrl.trim().replace(/\.git$/, '');
  // git@github.com:owner/repo or https://github.com/owner/repo
  const sshMatch = trimmed.match(/git@github\.com:([^/]+)\/([^/]+)/);
  if (sshMatch?.[1] && sshMatch[2]) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  const httpsMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/#?]+)/);
  if (httpsMatch?.[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

/**
 * Ensure GitHub Pages is enabled for the repository, configured to use the given branch.
 * Uses the GitHub API via `gh` CLI. No-op if gh is not authenticated or on failure.
 */
async function ensurePagesEnabled(owner: string, repo: string, branch: string): Promise<void> {
  const auth = await checkGhAuth();
  if (!auth.ok) return;

  const body = JSON.stringify({ source: { branch, path: '/' } });
  try {
    const getResult = await execa('gh', ['api', `repos/${owner}/${repo}/pages`, '--jq', '.source.branch'], {
      reject: false,
      encoding: 'utf8',
    });
    if (getResult.exitCode === 0) {
      const currentBranch = getResult.stdout?.trim();
      if (currentBranch === branch) return;
      await execa('gh', [
        'api',
        '-X',
        'PUT',
        `repos/${owner}/${repo}/pages`,
        '--input',
        '-',
      ], { input: body });
      console.log(`   GitHub Pages source updated to branch "${branch}".`);
    } else {
      await execa('gh', [
        'api',
        '-X',
        'POST',
        `repos/${owner}/${repo}/pages`,
        '--input',
        '-',
      ], { input: body });
      console.log(`   GitHub Pages enabled (source: branch "${branch}").`);
    }
  } catch {
    // Best-effort: continue without enabling; user can enable manually
  }
}

/**
 * Detect package manager from lock files.
 */
async function getPackageManager(cwd: string): Promise<'yarn' | 'pnpm' | 'npm'> {
  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}

/**
 * Run build script in the project (npm run build / yarn build / pnpm build).
 */
async function runBuild(cwd: string): Promise<void> {
  const pkgPath = path.join(cwd, 'package.json');
  const pkg = await fs.readJson(pkgPath);
  const scripts = (pkg.scripts as Record<string, string>) || {};
  if (!scripts['build']) {
    throw new Error(
      'No "build" script found in package.json. Add a build script or use --no-build and deploy an existing folder with -d/--dist-dir.'
    );
  }

  const pm = await getPackageManager(cwd);
  const runCmd = pm === 'npm' ? 'npm' : pm === 'yarn' ? 'yarn' : 'pnpm';
  const args = pm === 'npm' ? ['run', 'build'] : ['build'];
  console.log(`📦 Running build (${runCmd} ${args.join(' ')})...`);
  await execa(runCmd, args, { cwd, stdio: 'inherit' });
  console.log('✅ Build completed.\n');
}

/**
 * Deploy the built app to GitHub Pages using the gh-pages package.
 * Builds the project first unless skipBuild is true, then publishes distDir to the gh-pages branch.
 */
export async function runDeployToGitHubPages(
  projectPath: string,
  options: Partial<DeployOptions> = {}
): Promise<void> {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  const skipBuild = options.skipBuild ?? false;
  const branch = options.branch ?? DEFAULT_BRANCH;

  const cwd = path.resolve(projectPath);
  const pkgPath = path.join(cwd, 'package.json');

  if (!(await fs.pathExists(pkgPath))) {
    throw new Error(
      'No package.json found in this directory. Run this command from your project root (or pass the project path).'
    );
  }

  let repoUrl: string;
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd,
      reject: true,
    });
    repoUrl = stdout.trim();
  } catch {
    throw new Error(
      'Please save your changes first, before deploying to GitHub Pages.'
    );
  }

  if (!skipBuild) {
    await runBuild(cwd);
  }

  const absoluteDist = path.join(cwd, distDir);
  if (!(await fs.pathExists(absoluteDist))) {
    throw new Error(
      `Build output directory "${distDir}" does not exist. Run a build first or specify the correct directory with -d/--dist-dir.`
    );
  }

  const parsed = parseRepoFromUrl(repoUrl);
  if (parsed) {
    await ensurePagesEnabled(parsed.owner, parsed.repo, branch);
  }

  console.log(`🚀 Deploying "${distDir}" to GitHub Pages (branch: ${branch})...`);
  await new Promise<void>((resolve, reject) => {
    ghPages.publish(
      absoluteDist,
      { branch, repo: repoUrl },
      (err) => (err ? reject(err) : resolve())
    );
  });
  console.log('\n✅ Deployed to GitHub Pages.');
  console.log('   Enable GitHub Pages in your repo: Settings → Pages → Source: branch "' + branch + '".');
  console.log('   If the site is at username.github.io/<repo-name>, set your app\'s base path (e.g. base: \'/<repo-name>/\' in Vite).\n');
}
