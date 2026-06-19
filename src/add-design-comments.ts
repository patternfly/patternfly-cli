import path from 'node:path';
import { execa } from 'execa';
import fs from 'fs-extra';
import { promptAndSetLocalGitUser } from './git-user-config.js';

const DESIGN_COMMENTS_PACKAGE = '@patternfly/design-comments';

export type RunAddDesignCommentsOptions = {
  /** Project root to install into. */
  cwd: string;
  /** When true, prompt for git user.name and user.email and store them locally. */
  gitInit?: boolean;
};

async function getPackageManager(cwd: string): Promise<'yarn' | 'pnpm' | 'npm'> {
  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}

function getInstallArgs(packageManager: 'yarn' | 'pnpm' | 'npm'): string[] {
  switch (packageManager) {
    case 'yarn':
      return ['add', DESIGN_COMMENTS_PACKAGE];
    case 'pnpm':
      return ['add', DESIGN_COMMENTS_PACKAGE];
    default:
      return ['install', DESIGN_COMMENTS_PACKAGE];
  }
}

async function ensureGitRepository(cwd: string): Promise<void> {
  const gitDir = path.join(cwd, '.git');
  if (!(await fs.pathExists(gitDir))) {
    await execa('git', ['init'], { stdio: 'inherit', cwd });
    console.log('✅ Git repository initialized.\n');
  }
}

/**
 * Install @patternfly/design-comments and run its integration script so users can pin comments on UI elements.
 */
export async function runAddDesignComments(options: RunAddDesignCommentsOptions): Promise<void> {
  const { cwd, gitInit = false } = options;

  const pkgJsonPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(pkgJsonPath))) {
    throw new Error(
      `No package.json found in ${cwd}.\n` +
        'Run this command from a Node.js project root (or create one with "patternfly-cli create").',
    );
  }

  await ensureGitRepository(cwd);

  if (gitInit) {
    await promptAndSetLocalGitUser(cwd);
  }

  const packageManager = await getPackageManager(cwd);
  const installArgs = getInstallArgs(packageManager);

  console.log(`📦 Installing ${DESIGN_COMMENTS_PACKAGE}...\n`);
  await execa(packageManager, installArgs, { cwd, stdio: 'inherit' });

  console.log('\n🔧 Running design-comments setup...\n');
  await execa('npx', ['design-comments', 'init'], { cwd, stdio: 'inherit' });

  console.log(
    '\n✨ design-comments installed and integrated. Start your dev server to add comments on your UI.\n',
  );
}
