import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { offerAndCreateGitHubRepo } from './github.js';

/**
 * Runs the save flow: verify repo, check for changes, prompt to commit, then add/commit/push.
 * Throws on fatal errors (not a git repo, or git command failure). Caller should catch and process.exit(1).
 */
export async function runSave(cwd: string): Promise<void> {
  const gitDir = path.join(cwd, '.git');
  if (!(await fs.pathExists(gitDir))) {
    console.error('❌ This directory is not a git repository (.git not found).');
    console.error('   Initialize with "git init" or create a project with "patternfly-cli create".\n');
    throw new Error('Not a git repository');
  }

  const { stdout: statusOut } = await execa('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
  });
  const hasChanges = statusOut.trim().length > 0;

  if (!hasChanges) {
    console.log('📭 No changes to save (working tree clean).\n');
    return;
  }

  const { saveChanges } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveChanges',
      message: 'You have uncommitted changes. Would you like to save them?',
      default: true,
    },
  ]);

  if (!saveChanges) {
    console.log('\n📭 Nothing has been saved.\n');
    return;
  }

  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Describe your changes (commit message):',
      validate: (input: string) => {
        if (!input?.trim()) return 'A commit message is required to save.';
        return true;
      },
    },
  ]);

  const commitMessage = (message as string).trim();
  if (!commitMessage) {
    console.log('\n📭 No message provided; nothing has been saved.\n');
    return;
  }

  try {
    await execa('git', ['add', '.'], { cwd, stdio: 'inherit' });
    await execa('git', ['commit', '-m', commitMessage], { cwd, stdio: 'inherit' });

    // If no remote origin, offer to create a GitHub repository before pushing
    let hasOrigin = false;
    try {
      await execa('git', ['remote', 'get-url', 'origin'], { cwd, reject: true });
      hasOrigin = true;
    } catch {
      // no origin
    }
    if (!hasOrigin) {
      const created = await offerAndCreateGitHubRepo(cwd);
      if (!created) {
        console.error(
          '\n❌ Push skipped. Set a remote (e.g. "patternfly-cli init" or "git remote add origin <url>") then try save again.\n',
        );
        throw new Error('No remote origin');
      }
    }

    await execa('git', ['push'], { cwd, stdio: 'inherit' });
    console.log('\n✅ Changes saved and pushed to GitHub successfully.\n');
  } catch (err) {
    if (err && typeof err === 'object' && 'exitCode' in err) {
      const code = (err as { exitCode?: number }).exitCode;
      if (code === 128) {
        console.error(
          '\n❌ Push failed. You may need to set a remote (e.g. "git remote add origin <url>") or run "gh auth login".\n',
        );
      } else {
        console.error('\n❌ Save or push failed. See the output above for details.\n');
      }
    } else if (!(err instanceof Error && err.message === 'No remote origin')) {
      console.error('\n❌ An error occurred:');
      if (err instanceof Error) console.error(`   ${err.message}\n`);
      else console.error(`   ${String(err)}\n`);
    }
    throw err;
  }
}
