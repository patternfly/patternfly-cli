import { execa } from 'execa';
import inquirer from 'inquirer';

async function getGlobalGitValue(key: 'user.name' | 'user.email'): Promise<string | undefined> {
  const result = await execa('git', ['config', '--global', key], { reject: false });
  const value = result.stdout?.trim();
  return value || undefined;
}

/**
 * Prompts for user.name and user.email and sets them locally for the repository at cwd.
 * Defaults are taken from global git config when present.
 */
export async function promptAndSetLocalGitUser(cwd: string): Promise<void> {
  const defaultName = await getGlobalGitValue('user.name');
  const defaultEmail = await getGlobalGitValue('user.email');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'userName',
      message: 'Git user.name for this repository:',
      default: defaultName ?? '',
    },
    {
      type: 'input',
      name: 'userEmail',
      message: 'Git user.email for this repository:',
      default: defaultEmail ?? '',
    },
  ]);

  const name = typeof answers.userName === 'string' ? answers.userName.trim() : '';
  const email = typeof answers.userEmail === 'string' ? answers.userEmail.trim() : '';

  if (!name || !email) {
    console.error('\n⚠️  Both user.name and user.email are required. Git user was not configured.\n');
    return;
  }

  try {
    await execa('git', ['config', '--local', 'user.name', name], { cwd, stdio: 'inherit' });
    await execa('git', ['config', '--local', 'user.email', email], { cwd, stdio: 'inherit' });
    console.log('\n✅ Set local git user.name and user.email for this repository.\n');
  } catch {
    console.error('\n⚠️  Could not set git config. Ensure git is installed and this directory is a repository.\n');
  }
}
