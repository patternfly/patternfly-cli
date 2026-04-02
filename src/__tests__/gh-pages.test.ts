jest.mock('fs-extra', () => ({
  __esModule: true,
  default: {
    pathExists: jest.fn(),
    readJson: jest.fn(),
    copy: jest.fn(),
  },
}));

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('gh-pages', () => ({
  __esModule: true,
  default: {
    publish: jest.fn(),
  },
}));

jest.mock('../github.js', () => ({
  checkGhAuth: jest.fn().mockResolvedValue({ ok: false }),
}));

import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import ghPages from 'gh-pages';
import {
  getGitHubPagesPublicPath,
  getGitHubPagesSiteUrl,
  normalizeDeployBasePath,
  runDeployToGitHubPages,
} from '../gh-pages.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockReadJson = fs.readJson as jest.MockedFunction<typeof fs.readJson>;
const mockCopy = fs.copy as jest.MockedFunction<typeof fs.copy>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockGhPagesPublish = ghPages.publish as jest.MockedFunction<typeof ghPages.publish>;

const cwd = '/tmp/my-app';

/** Setup pathExists to return values based on path (avoids brittle call-order chains) */
function setupPathExists(checks: Record<string, boolean>) {
  mockPathExists.mockImplementation((p: string) => {
    if (p.endsWith(`${path.sep}404.html`) || p.endsWith('/404.html')) {
      return Promise.resolve(checks['404.html'] ?? false);
    }
    for (const [key, value] of Object.entries(checks)) {
      if (key === '404.html') continue;
      if (p.includes(key) || p === path.join(cwd, key)) return Promise.resolve(value);
    }
    return Promise.resolve(checks['*'] ?? false);
  });
}

describe('runDeployToGitHubPages', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  describe('getGitHubPagesPublicPath / normalizeDeployBasePath', () => {
    it('uses root for user GitHub Pages repo', () => {
      expect(getGitHubPagesPublicPath('octocat', 'octocat.github.io')).toBe('/');
    });

    it('uses /repo/ for project pages', () => {
      expect(getGitHubPagesPublicPath('octocat', 'Hello-World')).toBe('/Hello-World/');
    });

    it('builds HTTPS site URL for project pages', () => {
      expect(getGitHubPagesSiteUrl('octocat', 'Hello-World')).toBe(
        'https://octocat.github.io/Hello-World/'
      );
    });

    it('builds HTTPS site URL for user/org pages repo', () => {
      expect(getGitHubPagesSiteUrl('octocat', 'octocat.github.io')).toBe('https://octocat.github.io/');
    });

    it('normalizes base path overrides', () => {
      expect(normalizeDeployBasePath('/')).toBe('/');
      expect(normalizeDeployBasePath('my-app')).toBe('/my-app/');
      expect(normalizeDeployBasePath('/my-app')).toBe('/my-app/');
    });
  });

  it('throws when package.json does not exist', async () => {
    mockPathExists.mockImplementation((p: string) =>
      Promise.resolve(path.join(cwd, 'package.json') !== p)
    );

    await expect(runDeployToGitHubPages(cwd)).rejects.toThrow(
      'No package.json found in this directory'
    );
    expect(mockPathExists).toHaveBeenCalledWith(path.join(cwd, 'package.json'));
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('throws when git remote origin is not configured', async () => {
    setupPathExists({ 'package.json': true });
    mockExeca.mockRejectedValue(new Error('not a git repo'));

    await expect(runDeployToGitHubPages(cwd)).rejects.toThrow(
      'Please save your changes first, before deploying to GitHub Pages.'
    );
    expect(mockExeca).toHaveBeenCalledWith('git', ['remote', 'get-url', 'origin'], {
      cwd,
      reject: true,
    });
  });

  it('throws when no build script and skipBuild is false', async () => {
    setupPathExists({ 'package.json': true });
    mockReadJson.mockResolvedValueOnce({ scripts: {} });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'No "build" script found in package.json'
    );
    expect(mockReadJson).toHaveBeenCalledWith(path.join(cwd, 'package.json'));
    expect(mockExeca).toHaveBeenCalledTimes(1); // only git
  });

  it('runs build then deploys when skipBuild is false (npm)', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack --config webpack.prod.js' },
    });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenCalledTimes(2); // git, npm run build
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'npm', ['run', 'build'], {
      cwd,
      stdio: 'inherit',
      env: expect.objectContaining({ ASSET_PATH: '/repo/' }),
    });
    expect(mockCopy).toHaveBeenCalledWith(
      path.join(cwd, 'dist', 'index.html'),
      path.join(cwd, 'dist', '404.html')
    );
    expect(mockGhPagesPublish).toHaveBeenCalledWith(
      path.join(cwd, 'dist'),
      { branch: 'gh-pages', repo: 'https://github.com/user/repo.git' },
      expect.any(Function)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running build')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deployed to GitHub Pages')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://user.github.io/repo/')
    );
  });

  it('uses yarn when yarn.lock exists', async () => {
    setupPathExists({ 'package.json': true, 'yarn.lock': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack' },
    });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(2, 'yarn', ['run', 'build'], {
      cwd,
      stdio: 'inherit',
      env: expect.objectContaining({ ASSET_PATH: '/repo/' }),
    });
  });

  it('does not set ASSET_PATH for <user>.github.io repository (site root)', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack --config webpack.prod.js' },
    });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/octocat/octocat.github.io.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    const buildOpts = mockExeca.mock.calls[1][2] as { env?: NodeJS.ProcessEnv };
    expect(buildOpts.env?.ASSET_PATH).toBeUndefined();
  });

  it('uses pnpm when pnpm-lock.yaml exists (and no yarn.lock)', async () => {
    setupPathExists({ 'package.json': true, 'pnpm-lock.yaml': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'vite build' },
    });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(2, 'pnpm', ['run', 'build', '--', '--base', '/repo/'], {
      cwd,
      stdio: 'inherit',
      env: expect.objectContaining({ ASSET_PATH: '/repo/' }),
    });
  });

  it('skips build and deploys when skipBuild is true', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, { skipBuild: true });

    expect(mockReadJson).not.toHaveBeenCalled();
    expect(mockExeca).toHaveBeenCalledTimes(1); // git only
    expect(mockGhPagesPublish).toHaveBeenCalledWith(
      path.join(cwd, 'dist'),
      { branch: 'gh-pages', repo: 'https://github.com/user/repo.git' },
      expect.any(Function)
    );
  });

  it('throws when dist directory does not exist (after build)', async () => {
    setupPathExists({ 'package.json': true, 'dist': false });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'npm run build' },
    });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, npm run build
  });

  it('throws when dist directory does not exist with skipBuild true', async () => {
    setupPathExists({ 'package.json': true, 'dist': false });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // git only
  });

  it('uses custom distDir and branch options', async () => {
    setupPathExists({ 'package.json': true, 'build': true });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) => cb(null));
    mockCopy.mockResolvedValue(undefined);

    await runDeployToGitHubPages(cwd, {
      skipBuild: true,
      distDir: 'build',
      branch: 'pages',
    });

    expect(mockGhPagesPublish).toHaveBeenCalledWith(
      path.join(cwd, 'build'),
      { branch: 'pages', repo: 'https://github.com/user/repo.git' },
      expect.any(Function)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deploying "build" to GitHub Pages (branch: pages)')
    );
  });

  it('propagates build failure', async () => {
    setupPathExists({ 'package.json': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack' },
    });
    mockExeca
      .mockResolvedValueOnce({
        stdout: 'https://github.com/user/repo.git',
        stderr: '',
        exitCode: 0,
      } as Awaited<ReturnType<typeof execa>>)
      .mockRejectedValueOnce(new Error('Build failed'));

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, npm run build
  });

  it('propagates gh-pages deploy failure', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockExeca.mockResolvedValue({
      stdout: 'https://github.com/user/repo.git',
      stderr: '',
      exitCode: 0,
    } as Awaited<ReturnType<typeof execa>>);
    mockCopy.mockResolvedValue(undefined);
    mockGhPagesPublish.mockImplementation((_dir, _opts, cb) =>
      cb(new Error('Deploy failed'))
    );

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Deploy failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // git only
  });
});
