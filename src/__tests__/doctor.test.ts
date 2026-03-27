jest.mock('execa');

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}));

jest.mock('os', () => {
  const actual = jest.requireActual<typeof import('os')>('os');
  return {
    ...actual,
    platform: jest.fn(() => actual.platform()),
  };
});

import fs from 'fs';
import * as os from 'os';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { runDoctor } from '../doctor.js';

const mockedExeca = jest.mocked(execa);
const mockedOsPlatform = os.platform as jest.MockedFunction<typeof os.platform>;
const mockPrompt = inquirer.prompt as jest.Mock;

function setNodeVersion(version: string): void {
  Object.defineProperty(process, 'version', {
    value: version,
    configurable: true,
    enumerable: true,
  });
}

describe('runDoctor', () => {
  const originalVersion = process.version;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setNodeVersion('v20.0.0');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedOsPlatform.mockReturnValue('darwin');
    mockPrompt.mockResolvedValue({ proceedWithSudo: true });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    mockedOsPlatform.mockReturnValue('darwin');
    setNodeVersion(originalVersion);
  });

  function logOutput(): string {
    return consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  it('reports success when Node is sufficient, corepack works, and gh is installed', async () => {
    mockedExeca.mockResolvedValue({ stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>);

    await runDoctor(false);

    expect(mockedExeca).toHaveBeenCalledWith('corepack', ['--version'], { stdio: 'pipe' });
    expect(mockedExeca).toHaveBeenCalledWith('gh', ['--version'], { stdio: 'pipe' });
    expect(logOutput()).toContain('✅ Node.js version v20.0.0');
    expect(logOutput()).toContain('✅ Corepack is enabled');
    expect(logOutput()).toContain('✅ GitHub CLI is installed');
    expect(logOutput()).toContain('All requirements are satisfied');
  });

  it('treats Node.js major 20 as supported (boundary)', async () => {
    setNodeVersion('v20.0.0');
    mockedExeca.mockResolvedValue({ stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>);

    await runDoctor(false);

    expect(logOutput()).toContain('✅ Node.js version v20.0.0 (>= 20)');
  });

  it('fails Node check when major version is below 20', async () => {
    setNodeVersion('v18.20.0');
    mockedExeca.mockResolvedValue({ stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>);

    await runDoctor(false);

    expect(logOutput()).toContain('❌ Node.js version v18.20.0');
    expect(logOutput()).toContain('Some requirements are not satisfied');
    expect(logOutput()).toContain('Node.js must be manually installed');
    expect(logOutput()).toContain('patternfly-cli doctor --fix');
    expect(logOutput()).toContain('NOT Node.js');
  });

  it('does not print --fix hints when autoFix is true and checks fail', async () => {
    setNodeVersion('v18.0.0');
    mockedExeca.mockResolvedValue({ stdout: '' } as Awaited<ReturnType<typeof execa>>);

    await runDoctor(true);

    expect(logOutput()).not.toContain('Run with --fix');
  });

  it('reports corepack missing and does not enable when autoFix is false', async () => {
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        throw new Error('not found');
      }
      if (cmd === 'gh') {
        return { stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(false);

    expect(logOutput()).toContain('❌ Corepack is not enabled');
    expect(mockedExeca).not.toHaveBeenCalledWith('corepack', ['enable'], expect.anything());
  });

  it('runs corepack enable when corepack check fails and autoFix is true', async () => {
    let corepackVersionCalls = 0;
    mockedExeca.mockImplementation(async (cmd, args) => {
      if (cmd === 'corepack' && args?.[0] === '--version') {
        corepackVersionCalls += 1;
        throw new Error('not found');
      }
      if (cmd === 'corepack' && args?.[0] === 'enable') {
        return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        return { stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(true);

    expect(corepackVersionCalls).toBe(1);
    expect(mockedExeca).toHaveBeenCalledWith('corepack', ['enable'], { stdio: 'inherit' });
    expect(logOutput()).toContain('✅ Corepack is now enabled');
  });

  it('logs enable failure when corepack enable throws under autoFix', async () => {
    mockedExeca.mockImplementation(async (cmd, args) => {
      if (cmd === 'corepack' && args?.[0] === '--version') {
        throw new Error('not found');
      }
      if (cmd === 'corepack' && args?.[0] === 'enable') {
        throw new Error('permission denied');
      }
      if (cmd === 'gh') {
        return { stdout: 'gh version 2.0.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(true);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to enable corepack'),
    );
  });

  it('reports GitHub CLI missing when gh --version fails', async () => {
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(false);

    expect(logOutput()).toContain('❌ GitHub CLI is not installed');
    expect(logOutput()).toContain('Some requirements are not satisfied');
  });

  it('includes first line of gh --version output in success message', async () => {
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'gh') {
        return {
          stdout: 'gh version 2.40.1 (2023-01-01)\nbuild: xyz\n',
        } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(false);

    expect(logOutput()).toContain('✅ GitHub CLI is installed (gh version 2.40.1 (2023-01-01))');
  });

  it('invokes brew install gh on darwin when gh is missing and autoFix is true', async () => {
    mockedOsPlatform.mockReturnValue('darwin');
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      if (cmd === 'brew') {
        return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(true);

    expect(mockedExeca).toHaveBeenCalledWith('brew', ['install', 'gh'], { stdio: 'inherit' });
    expect(logOutput()).toContain('GitHub CLI installed successfully');
  });

  it('invokes winget on win32 when gh is missing and autoFix is true', async () => {
    mockedOsPlatform.mockReturnValue('win32');
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      if (cmd === 'winget') {
        return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await runDoctor(true);

    expect(mockedExeca).toHaveBeenCalledWith(
      'winget',
      ['install', '--id', 'GitHub.cli'],
      { stdio: 'inherit' },
    );
  });

  it('invokes apt on Debian-like linux when gh is missing and autoFix is true', async () => {
    mockedOsPlatform.mockReturnValue('linux');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/etc/debian_version');

    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      if (cmd === 'sudo') {
        return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    try {
      await runDoctor(true);
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith(
        'sudo',
        ['apt', 'install', 'gh', '-y'],
        { stdio: 'inherit' },
      );
    } finally {
      existsSpy.mockRestore();
    }
  });

  it('skips apt install when user declines sudo prompt under autoFix', async () => {
    mockedOsPlatform.mockReturnValue('linux');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/etc/debian_version');
    mockPrompt.mockResolvedValueOnce({ proceedWithSudo: false });

    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    try {
      await runDoctor(true);
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockedExeca).not.toHaveBeenCalledWith('sudo', expect.anything(), expect.anything());
      expect(logOutput()).toContain('GitHub CLI installation skipped');
    } finally {
      existsSpy.mockRestore();
    }
  });

  it('invokes dnf on RedHat-like linux when gh is missing and autoFix is true', async () => {
    mockedOsPlatform.mockReturnValue('linux');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/etc/redhat-release');

    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      if (cmd === 'sudo') {
        return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    try {
      await runDoctor(true);
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith(
        'sudo',
        ['dnf', 'install', 'gh', '-y'],
        { stdio: 'inherit' },
      );
    } finally {
      existsSpy.mockRestore();
    }
  });

  it('does not call package managers when linux has no known distro and gh is missing with autoFix', async () => {
    mockedOsPlatform.mockReturnValue('linux');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    try {
      await runDoctor(true);
      expect(mockedExeca).not.toHaveBeenCalledWith('sudo', expect.anything(), expect.anything());
      expect(mockedExeca).not.toHaveBeenCalledWith('brew', expect.anything(), expect.anything());
      expect(logOutput()).toContain('Unable to automatically install GitHub CLI');
      expect(logOutput()).toContain('cli.github.com');
    } finally {
      existsSpy.mockRestore();
    }
  });

  it('surfaces winget/gh install failure without throwing', async () => {
    mockedOsPlatform.mockReturnValue('win32');
    mockedExeca.mockImplementation(async (cmd) => {
      if (cmd === 'corepack') {
        return { stdout: '0.28.0\n' } as Awaited<ReturnType<typeof execa>>;
      }
      if (cmd === 'gh') {
        throw new Error('not found');
      }
      if (cmd === 'winget') {
        throw new Error('winget failed');
      }
      return { stdout: '' } as Awaited<ReturnType<typeof execa>>;
    });

    await expect(runDoctor(true)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install GitHub CLI'));
  });
});
