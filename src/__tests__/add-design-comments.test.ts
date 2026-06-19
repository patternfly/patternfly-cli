jest.mock('fs-extra', () => ({
  __esModule: true,
  default: {
    pathExists: jest.fn(),
  },
}));

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('../git-user-config.js', () => ({
  promptAndSetLocalGitUser: jest.fn(),
}));

import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { promptAndSetLocalGitUser } from '../git-user-config.js';
import { runAddDesignComments } from '../add-design-comments.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockPromptAndSetLocalGitUser = promptAndSetLocalGitUser as jest.MockedFunction<
  typeof promptAndSetLocalGitUser
>;

const cwd = '/tmp/design-comments-project';

function mockPathExistsForProject(options: { hasPackageJson?: boolean; hasGit?: boolean; lockFile?: 'yarn' | 'pnpm' | 'none' }): void {
  const { hasPackageJson = true, hasGit = true, lockFile = 'none' } = options;
  mockPathExists.mockImplementation(async (p: string) => {
    if (p === path.join(cwd, 'package.json')) return hasPackageJson;
    if (p === path.join(cwd, '.git')) return hasGit;
    if (p === path.join(cwd, 'yarn.lock')) return lockFile === 'yarn';
    if (p === path.join(cwd, 'pnpm-lock.yaml')) return lockFile === 'pnpm';
    return false;
  });
}

describe('runAddDesignComments', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<
      ReturnType<typeof execa>
    >);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('throws when package.json is missing', async () => {
    mockPathExistsForProject({ hasPackageJson: false });

    await expect(runAddDesignComments({ cwd })).rejects.toThrow(/No package\.json found/);
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('initializes git when .git is missing', async () => {
    mockPathExistsForProject({ hasGit: false });

    await runAddDesignComments({ cwd });

    expect(mockExeca).toHaveBeenCalledWith('git', ['init'], { stdio: 'inherit', cwd });
    expect(consoleLogSpy).toHaveBeenCalledWith('✅ Git repository initialized.\n');
  });

  it('skips git init when .git already exists', async () => {
    mockPathExistsForProject({ hasGit: true });

    await runAddDesignComments({ cwd });

    expect(mockExeca).not.toHaveBeenCalledWith('git', ['init'], expect.anything());
  });

  it('installs with npm and runs design-comments init by default', async () => {
    mockPathExistsForProject({ lockFile: 'none' });

    await runAddDesignComments({ cwd });

    expect(mockExeca).toHaveBeenCalledWith(
      'npm',
      ['install', '@patternfly/design-comments'],
      { cwd, stdio: 'inherit' },
    );
    expect(mockExeca).toHaveBeenCalledWith('npx', ['design-comments', 'init'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('uses yarn when yarn.lock is present', async () => {
    mockPathExistsForProject({ lockFile: 'yarn' });

    await runAddDesignComments({ cwd });

    expect(mockExeca).toHaveBeenCalledWith(
      'yarn',
      ['add', '@patternfly/design-comments'],
      { cwd, stdio: 'inherit' },
    );
  });

  it('uses pnpm when pnpm-lock.yaml is present', async () => {
    mockPathExistsForProject({ lockFile: 'pnpm' });

    await runAddDesignComments({ cwd });

    expect(mockExeca).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@patternfly/design-comments'],
      { cwd, stdio: 'inherit' },
    );
  });

  it('prompts for local git user config when gitInit is true', async () => {
    mockPathExistsForProject({});

    await runAddDesignComments({ cwd, gitInit: true });

    expect(mockPromptAndSetLocalGitUser).toHaveBeenCalledWith(cwd);
  });

  it('does not prompt for local git user config by default', async () => {
    mockPathExistsForProject({});

    await runAddDesignComments({ cwd });

    expect(mockPromptAndSetLocalGitUser).not.toHaveBeenCalled();
  });

  it('runs git init, install, and design-comments init in order', async () => {
    mockPathExistsForProject({ hasGit: false, lockFile: 'none' });
    const callOrder: string[] = [];
    mockExeca.mockImplementation(async (command, args) => {
      if (command === 'git' && args?.[0] === 'init') callOrder.push('git-init');
      if (command === 'npm') callOrder.push('install');
      if (command === 'npx') callOrder.push('design-comments-init');
      return { stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>;
    });

    await runAddDesignComments({ cwd });

    expect(callOrder).toEqual(['git-init', 'install', 'design-comments-init']);
  });

  it('runs git user config after git init when gitInit is true', async () => {
    mockPathExistsForProject({ hasGit: false });
    const callOrder: string[] = [];
    mockExeca.mockImplementation(async (command, args) => {
      if (command === 'git' && args?.[0] === 'init') callOrder.push('git-init');
      if (command === 'npm') callOrder.push('install');
      return { stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>;
    });
    mockPromptAndSetLocalGitUser.mockImplementation(async () => {
      callOrder.push('git-user-config');
    });

    await runAddDesignComments({ cwd, gitInit: true });

    expect(callOrder).toEqual(['git-init', 'git-user-config', 'install']);
  });

  it('runs npx design-comments init after yarn install', async () => {
    mockPathExistsForProject({ lockFile: 'yarn' });

    await runAddDesignComments({ cwd });

    const yarnIdx = mockExeca.mock.calls.findIndex(([cmd]) => cmd === 'yarn');
    const npxIdx = mockExeca.mock.calls.findIndex(([cmd]) => cmd === 'npx');
    expect(yarnIdx).toBeGreaterThan(-1);
    expect(npxIdx).toBeGreaterThan(yarnIdx);
    expect(mockExeca).toHaveBeenCalledWith('npx', ['design-comments', 'init'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('runs npx design-comments init after pnpm install', async () => {
    mockPathExistsForProject({ lockFile: 'pnpm' });

    await runAddDesignComments({ cwd });

    const pnpmIdx = mockExeca.mock.calls.findIndex(([cmd]) => cmd === 'pnpm');
    const npxIdx = mockExeca.mock.calls.findIndex(([cmd]) => cmd === 'npx');
    expect(pnpmIdx).toBeGreaterThan(-1);
    expect(npxIdx).toBeGreaterThan(pnpmIdx);
  });

  it('logs install and success messages', async () => {
    mockPathExistsForProject({});

    await runAddDesignComments({ cwd });

    expect(consoleLogSpy).toHaveBeenCalledWith('📦 Installing @patternfly/design-comments...\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('\n🔧 Running design-comments setup...\n');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\n✨ design-comments installed and integrated. Start your dev server to add comments on your UI.\n',
    );
  });

  it('propagates errors from package install', async () => {
    mockPathExistsForProject({});
    const installError = new Error('npm install failed');
    mockExeca.mockImplementation(async (command) => {
      if (command === 'npm') throw installError;
      return { stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>;
    });

    await expect(runAddDesignComments({ cwd })).rejects.toThrow('npm install failed');
    expect(mockExeca).not.toHaveBeenCalledWith('npx', ['design-comments', 'init'], expect.anything());
  });

  it('propagates errors from design-comments init', async () => {
    mockPathExistsForProject({});
    const initError = new Error('design-comments init failed');
    mockExeca.mockImplementation(async (command) => {
      if (command === 'npx') throw initError;
      return { stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>;
    });

    await expect(runAddDesignComments({ cwd })).rejects.toThrow('design-comments init failed');
    expect(mockExeca).toHaveBeenCalledWith(
      'npm',
      ['install', '@patternfly/design-comments'],
      { cwd, stdio: 'inherit' },
    );
  });
});
