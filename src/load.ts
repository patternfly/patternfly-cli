import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';

/**
 * Runs the load flow: verify repo, then pull the latest updates from the remote.
 * Throws on fatal errors (not a git repo, or git command failure). Caller should catch and process.exit(1).
 */
export async function runLoad(cwd: string): Promise<void> {
  const gitDir = path.join(cwd, '.git');
  if (!(await fs.pathExists(gitDir))) {
    console.error('❌ This directory is not a git repository (.git not found).');
    console.error('   Initialize with "git init" or create a project with "patternfly-cli create".\n');
    throw new Error('Not a git repository');
  }

  try {
    console.log('📥 Pulling latest updates from GitHub...\n');
    await execa('git', ['pull'], { cwd, stdio: 'inherit' });
    console.log('\n✅ Latest updates loaded successfully.\n');
  } catch (err) {
    if (err && typeof err === 'object' && 'exitCode' in err) {
      const code = (err as { exitCode?: number }).exitCode;
      if (code === 128) {
        console.error(
          '\n❌ Pull failed. You may need to set a remote (e.g. "git remote add origin <url>") or run "gh auth login".\n',
        );
      } else {
        console.error('\n❌ Pull failed. See the output above for details.\n');
      }
    } else {
      console.error('\n❌ An error occurred:');
      if (err instanceof Error) console.error(`   ${err.message}\n`);
      else console.error(`   ${String(err)}\n`);
    }
    throw err;
  }
}
