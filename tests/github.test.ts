jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import {
  sanitizeRepoName,
  checkGhAuth,
  repoExists,
  createRepo,
} from '../src/github.js';
import { execa as mockExeca } from 'execa';

describe('sanitizeRepoName', () => {
  it('returns lowercase name with invalid chars replaced by hyphen', () => {
    expect(sanitizeRepoName('My Project')).toBe('my-project');
    expect(sanitizeRepoName('my_project')).toBe('my_project');
  });

  it('strips npm scope and uses package name only', () => {
    expect(sanitizeRepoName('@my-org/my-package')).toBe('my-package');
    expect(sanitizeRepoName('@scope/package-name')).toBe('package-name');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeRepoName('my---project')).toBe('my-project');
    expect(sanitizeRepoName('  spaces  ')).toBe('spaces');
  });

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeRepoName('--my-project--')).toBe('my-project');
    expect(sanitizeRepoName('-single-')).toBe('single');
  });

  it('allows alphanumeric, hyphens, underscores, and dots', () => {
    expect(sanitizeRepoName('my.project_1')).toBe('my.project_1');
    expect(sanitizeRepoName('v1.0.0')).toBe('v1.0.0');
  });

  it('returns "my-project" when result would be empty', () => {
    expect(sanitizeRepoName('@scope/---')).toBe('my-project');
    expect(sanitizeRepoName('!!!')).toBe('my-project');
  });

  it('handles scoped package with only special chars after scope', () => {
    expect(sanitizeRepoName('@org/---')).toBe('my-project');
  });
});

describe('checkGhAuth', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns ok: false when gh auth status fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('not logged in'));

    const result = await checkGhAuth();

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('GitHub CLI (gh) is not installed'),
    });
    expect(mockExeca).toHaveBeenCalledWith('gh', ['auth', 'status'], { reject: true });
  });

  it('returns ok: false when gh api user returns empty login', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    mockExeca.mockResolvedValueOnce({ stdout: '\n  \n', stderr: '', exitCode: 0 });

    const result = await checkGhAuth();

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('Could not determine your GitHub username'),
    });
  });

  it('returns ok: false when gh api user throws', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    mockExeca.mockRejectedValueOnce(new Error('API error'));

    const result = await checkGhAuth();

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('Could not fetch your GitHub username'),
    });
  });

  it('returns ok: true with username when auth and api succeed', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    mockExeca.mockResolvedValueOnce({
      stdout: '  octocat  ',
      stderr: '',
      exitCode: 0,
    });

    const result = await checkGhAuth();

    expect(result).toEqual({ ok: true, username: 'octocat' });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'gh', ['api', 'user', '--jq', '.login'], {
      encoding: 'utf8',
    });
  });
});

describe('repoExists', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns true when gh api repos/owner/repo succeeds', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '{}', stderr: '', exitCode: 0 });

    const result = await repoExists('octocat', 'my-repo');

    expect(result).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith('gh', ['api', 'repos/octocat/my-repo'], {
      reject: true,
    });
  });

  it('returns false when gh api throws (e.g. 404)', async () => {
    mockExeca.mockRejectedValueOnce(new Error('Not Found'));

    const result = await repoExists('octocat', 'nonexistent');

    expect(result).toBe(false);
  });
});

describe('createRepo', () => {
  const projectPath = '/tmp/my-app';
  const username = 'octocat';

  beforeEach(() => {
    mockExeca.mockReset();
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  });

  it('initializes git and calls gh repo create with expected args and returns repo URL', async () => {
    mockExeca
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(new Error('no HEAD'))
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const url = await createRepo({
      repoName: 'my-app',
      projectPath,
      username,
    });

    expect(url).toBe('https://github.com/octocat/my-app.git');
    expect(mockExeca).toHaveBeenCalledTimes(5);
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'git', ['init'], {
      stdio: 'inherit',
      cwd: projectPath,
    });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'git', ['rev-parse', '--verify', 'HEAD'], expect.any(Object));
    expect(mockExeca).toHaveBeenNthCalledWith(3, 'git', ['add', '.'], {
      stdio: 'inherit',
      cwd: projectPath,
    });
    expect(mockExeca).toHaveBeenNthCalledWith(4, 'git', ['commit', '-m', 'Initial commit'], {
      stdio: 'inherit',
      cwd: projectPath,
    });
    expect(mockExeca).toHaveBeenNthCalledWith(
      5,
      'gh',
      [
        'repo',
        'create',
        'my-app',
        '--public',
        `--source=${projectPath}`,
        '--remote=origin',
        '--push',
      ],
      { stdio: 'inherit', cwd: projectPath },
    );
  });

  it('passes description when provided', async () => {
    mockExeca
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(new Error('no HEAD'))
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await createRepo({
      repoName: 'my-app',
      projectPath,
      username,
      description: 'My cool project',
    });

    expect(mockExeca).toHaveBeenNthCalledWith(
      5,
      'gh',
      expect.arrayContaining(['--description=My cool project']),
      expect.any(Object),
    );
  });
});
