import { execa } from 'execa';
import * as os from 'os';

interface CheckResult {
  passed: boolean;
  message: string;
}

/** Check if Node.js version is >= 20 */
async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0] || '0', 10);

  if (majorVersion >= 20) {
    return {
      passed: true,
      message: `✅ Node.js version ${version} (>= 20)`,
    };
  }

  return {
    passed: false,
    message: `❌ Node.js version ${version} is not supported. Please install Node.js >= 20 from https://nodejs.org/`,
  };
}

/** Check if corepack is enabled */
async function checkCorepack(): Promise<CheckResult> {
  try {
    await execa('corepack', ['--version'], { stdio: 'pipe' });
    return {
      passed: true,
      message: '✅ Corepack is enabled',
    };
  } catch {
    return {
      passed: false,
      message: '❌ Corepack is not enabled',
    };
  }
}

/** Enable corepack */
async function enableCorepack(): Promise<void> {
  console.log('\n🔧 Enabling corepack...');
  try {
    await execa('corepack', ['enable'], { stdio: 'inherit' });
    console.log('✅ Corepack enabled successfully\n');
  } catch (error) {
    throw new Error('Failed to enable corepack. You may need to run this command with elevated privileges (sudo).');
  }
}

/** Check if GitHub CLI is installed */
async function checkGitHubCLI(): Promise<CheckResult> {
  try {
    const { stdout } = await execa('gh', ['--version'], { stdio: 'pipe' });
    const version = stdout.split('\n')[0];
    return {
      passed: true,
      message: `✅ GitHub CLI is installed (${version})`,
    };
  } catch {
    return {
      passed: false,
      message: '❌ GitHub CLI is not installed',
    };
  }
}

/** Get OS-specific installation instructions for GitHub CLI */
function getGitHubCLIInstallCommand(): { command: string; args: string[]; description: string } | null {
  const platform = os.platform();

  switch (platform) {
    case 'darwin':
      return {
        command: 'brew',
        args: ['install', 'gh'],
        description: 'Installing GitHub CLI via Homebrew',
      };
    case 'linux': {
      try {
        const fs = require('fs');
        if (fs.existsSync('/etc/debian_version')) {
          return {
            command: 'sudo',
            args: ['apt', 'install', 'gh', '-y'],
            description: 'Installing GitHub CLI via apt',
          };
        } else if (fs.existsSync('/etc/redhat-release')) {
          return {
            command: 'sudo',
            args: ['dnf', 'install', 'gh', '-y'],
            description: 'Installing GitHub CLI via dnf',
          };
        }
      } catch {
      }
      return null;
    }
    case 'win32':
      return {
        command: 'winget',
        args: ['install', '--id', 'GitHub.cli'],
        description: 'Installing GitHub CLI via winget',
      };
    default:
      return null;
  }
}

/** Install GitHub CLI */
async function installGitHubCLI(): Promise<void> {
  const installCommand = getGitHubCLIInstallCommand();

  if (!installCommand) {
    console.log('\n⚠️  Unable to automatically install GitHub CLI for your operating system.');
    console.log('Please visit https://cli.github.com/ for installation instructions.\n');
    return;
  }

  console.log(`\n🔧 ${installCommand.description}...`);
  try {
    await execa(installCommand.command, installCommand.args, { stdio: 'inherit' });
    console.log('✅ GitHub CLI installed successfully\n');
  } catch (error) {
    console.error(`\n❌ Failed to install GitHub CLI automatically.`);
    console.error('Please visit https://cli.github.com/ for manual installation instructions.\n');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

/** Run the doctor command to check and fix requirements */
export async function runDoctor(autoFix: boolean = false): Promise<void> {
  console.log('\n🏥 Running Patternfly CLI Doctor...\n');
  console.log('Checking requirements...\n');

  const results: CheckResult[] = [];
  let allPassed = true;

  const nodeResult = await checkNodeVersion();
  results.push(nodeResult);
  console.log(nodeResult.message);
  if (!nodeResult.passed) {
    allPassed = false;
  }

  const corepackResult = await checkCorepack();
  results.push(corepackResult);
  console.log(corepackResult.message);
  if (!corepackResult.passed) {
    allPassed = false;
    if (autoFix) {
      try {
        await enableCorepack();
        console.log('✅ Corepack is now enabled');
      } catch (error) {
        if (error instanceof Error) {
          console.error(`❌ ${error.message}`);
        }
      }
    }
  }

  const ghResult = await checkGitHubCLI();
  results.push(ghResult);
  console.log(ghResult.message);
  if (!ghResult.passed) {
    allPassed = false;
    if (autoFix) {
      await installGitHubCLI();
    }
  }

  console.log('\n' + '─'.repeat(60) + '\n');

  if (allPassed) {
    console.log('✨ All requirements are satisfied! You are ready to use Patternfly CLI.\n');
  } else {
    console.log('⚠️  Some requirements are not satisfied.\n');

    if (!nodeResult.passed) {
      console.log('📌 Node.js must be manually installed or updated.');
      console.log('   Download from: https://nodejs.org/ (LTS version recommended)\n');
    }

    if (!autoFix) {
      console.log('Run with --fix to automatically install missing requirements:\n');
      console.log('  patternfly-cli doctor --fix\n');
      console.log('Note: --fix can install corepack and GitHub CLI, but NOT Node.js.\n');
    }
  }
}
