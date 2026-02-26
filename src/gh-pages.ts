import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';

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
 * Deploy the built app to GitHub Pages using gh-pages (npx).
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
  const gitDir = path.join(cwd, '.git');

  if (!(await fs.pathExists(pkgPath))) {
    throw new Error(
      'No package.json found in this directory. Run this command from your project root (or pass the project path).'
    );
  }

  if (!(await fs.pathExists(gitDir))) {
    throw new Error(
      'This directory is not a git repository. Initialize with "git init" or use "patternfly-cli init", and ensure the repo has a remote (e.g. GitHub) before deploying.'
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

  console.log(`🚀 Deploying "${distDir}" to GitHub Pages (branch: ${branch})...`);
  await execa('npx', ['gh-pages', '-d', distDir, '-b', branch], {
    cwd,
    stdio: 'inherit',
  });
  console.log('\n✅ Deployed to GitHub Pages.');
  console.log('   Enable GitHub Pages in your repo: Settings → Pages → Source: branch "' + branch + '".');
  console.log('   If the site is at username.github.io/<repo-name>, set your app\'s base path (e.g. base: \'/<repo-name>/\' in Vite).\n');
}
