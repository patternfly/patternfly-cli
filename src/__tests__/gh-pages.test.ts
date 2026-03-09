jest.mock('fs-extra', () => ({
  __esModule: true,
  default: {
    pathExists: jest.fn(),
    readJson: jest.fn(),
  },
}));

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { runDeployToGitHubPages } from '../gh-pages.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockReadJson = fs.readJson as jest.MockedFunction<typeof fs.readJson>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;

const cwd = '/tmp/my-app';

/** Setup pathExists to return values based on path (avoids brittle call-order chains) */
function setupPathExists(checks: Record<string, boolean>) {
  mockPathExists.mockImplementation((p: string) => {
    for (const [key, value] of Object.entries(checks)) {
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
    mockExeca.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof execa>>);

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
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

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
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenCalledTimes(3); // git, npm run build, gh-pages
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'npm', ['run', 'build'], {
      cwd,
      stdio: 'inherit',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(3, 'gh-pages', ['-d', 'dist', '-b', 'gh-pages'], {
      cwd,
      stdio: 'inherit',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running build')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deployed to GitHub Pages')
    );
  });

  it('uses yarn when yarn.lock exists', async () => {
    setupPathExists({ 'package.json': true, 'yarn.lock': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(2, 'yarn', ['build'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('uses pnpm when pnpm-lock.yaml exists (and no yarn.lock)', async () => {
    setupPathExists({ 'package.json': true, 'pnpm-lock.yaml': true, 'dist': true });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'vite build' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(2, 'pnpm', ['build'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('skips build and deploys when skipBuild is true', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: true });

    expect(mockReadJson).not.toHaveBeenCalled();
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, gh-pages
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'gh-pages', ['-d', 'dist', '-b', 'gh-pages'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('throws when dist directory does not exist (after build)', async () => {
    setupPathExists({ 'package.json': true, 'dist': false });
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'npm run build' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, npm run build
  });

  it('throws when dist directory does not exist with skipBuild true', async () => {
    setupPathExists({ 'package.json': true, 'dist': false });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // git only
  });

  it('uses custom distDir and branch options', async () => {
    setupPathExists({ 'package.json': true, 'build': true });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, {
      skipBuild: true,
      distDir: 'build',
      branch: 'pages',
    });

    expect(mockExeca).toHaveBeenNthCalledWith(2, 'gh-pages', ['-d', 'build', '-b', 'pages'], {
      cwd,
      stdio: 'inherit',
    });
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
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>)
      .mockRejectedValueOnce(new Error('Build failed'));

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, npm run build
  });

  it('propagates gh-pages deploy failure', async () => {
    setupPathExists({ 'package.json': true, 'dist': true });
    mockExeca
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>)
      .mockRejectedValueOnce(new Error('Deploy failed'));

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Deploy failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(2); // git, gh-pages
  });
});
