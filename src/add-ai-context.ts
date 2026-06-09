import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { execa } from 'execa';
import fs from 'fs-extra';
import { getCliPackageRoot } from './cli-package-root.js';

function getRequireFromCliPackage(): NodeJS.Require {
  const root = getCliPackageRoot();
  return createRequire(path.join(root, 'package.json'));
}

function resolveJscodeshiftBin(): string {
  try {
    return getRequireFromCliPackage().resolve('jscodeshift/bin/jscodeshift.js');
  } catch {
    throw new Error(
      'Could not load jscodeshift from patternfly-cli dependencies. ' +
        'Reinstall patternfly-cli (npm i -g @patternfly/patternfly-cli) or run from a fresh npx install.',
    );
  }
}

async function resolveBundledTransformPath(): Promise<string> {
  const requireFromCli = getRequireFromCliPackage();
  const pkgJson = requireFromCli.resolve('@patternfly/context-for-ai/package.json');
  const transformPath = path.join(path.dirname(pkgJson), 'codemod', 'transform.js');
  if (!(await fs.pathExists(transformPath))) {
    throw new Error(
      `Could not find @patternfly/context-for-ai codemod at ${transformPath}. ` +
        'Reinstall patternfly-cli so the dependency is present.',
    );
  }
  return transformPath;
}

export type RunAddAiContextOptions = {
  /** Directory to resolve `targetPath` against (usually the user's project root). */
  cwd: string;
  /** Directory or file to transform; relative to `cwd`. Default: `src`. */
  targetPath?: string;
  /** When true, pass jscodeshift `--dry` (preview only). */
  dryRun?: boolean;
  /**
   * Absolute path to `transform.js` (defaults to the copy bundled with patternfly-cli).
   * Tests and advanced setups may set this explicitly.
   */
  transformPath?: string;
};

/**
 * Run the @patternfly/context-for-ai jscodeshift transform on the user's codebase.
 */
export async function runAddAiContext(options: RunAddAiContextOptions): Promise<void> {
  const { cwd, targetPath = 'src', dryRun = false, transformPath: transformPathOpt } = options;
  const resolvedTarget = path.resolve(cwd, targetPath);

  if (!(await fs.pathExists(resolvedTarget))) {
    throw new Error(
      `Path does not exist: ${resolvedTarget}\n` +
        'Pass an existing directory or file, or run this command from your project root.',
    );
  }

  const transformPath = transformPathOpt ?? (await resolveBundledTransformPath());
  if (transformPathOpt !== undefined && !(await fs.pathExists(transformPath))) {
    throw new Error(`Codemod transform not found: ${transformPath}`);
  }

  const jscodeshiftBin = resolveJscodeshiftBin();
  if (!(await fs.pathExists(jscodeshiftBin))) {
    throw new Error(`jscodeshift CLI missing at ${jscodeshiftBin}. Reinstall patternfly-cli.`);
  }

  const args = ['-t', transformPath, '--extensions=ts,tsx,js,jsx', '--parser=tsx'];
  if (dryRun) {
    args.push('--dry');
  }
  args.push(resolvedTarget);

  console.log(`Running @patternfly/context-for-ai codemod on ${resolvedTarget}...`);
  if (dryRun) {
    console.log('(dry run — no files will be modified)\n');
  }

  await execa(process.execPath, [jscodeshiftBin, ...args], { cwd, stdio: 'inherit' });
}
