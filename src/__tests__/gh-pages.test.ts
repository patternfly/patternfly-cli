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

  it('throws when .git directory does not exist', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(false); // .git

    await expect(runDeployToGitHubPages(cwd)).rejects.toThrow(
      'This directory is not a git repository'
    );
    expect(mockPathExists).toHaveBeenCalledWith(path.join(cwd, '.git'));
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('throws when no build script and skipBuild is false', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true); // .git
    mockReadJson.mockResolvedValueOnce({ scripts: {} });

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'No "build" script found in package.json'
    );
    expect(mockReadJson).toHaveBeenCalledWith(path.join(cwd, 'package.json'));
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('runs build then deploys when skipBuild is false (npm)', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(false) // pnpm-lock.yaml
      .mockResolvedValueOnce(true); // dist
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack --config webpack.prod.js' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenCalledTimes(2);
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'npm', ['run', 'build'], {
      cwd,
      stdio: 'inherit',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'npx', ['gh-pages', '-d', 'dist', '-b', 'gh-pages'], {
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
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(true) // yarn.lock
      .mockResolvedValueOnce(true); // dist
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(1, 'yarn', ['build'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('uses pnpm when pnpm-lock.yaml exists (and no yarn.lock)', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(true) // pnpm-lock.yaml
      .mockResolvedValueOnce(true); // dist
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'vite build' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: false });

    expect(mockExeca).toHaveBeenNthCalledWith(1, 'pnpm', ['build'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('skips build and deploys when skipBuild is true', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(true); // dist
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, { skipBuild: true });

    expect(mockReadJson).not.toHaveBeenCalled();
    expect(mockExeca).toHaveBeenCalledTimes(1);
    expect(mockExeca).toHaveBeenCalledWith('npx', ['gh-pages', '-d', 'dist', '-b', 'gh-pages'], {
      cwd,
      stdio: 'inherit',
    });
  });

  it('throws when dist directory does not exist (after build)', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(false) // pnpm-lock.yaml
      .mockResolvedValueOnce(false); // dist (missing)
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'npm run build' },
    });
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // only build
  });

  it('throws when dist directory does not exist with skipBuild true', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(false); // dist

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Build output directory "dist" does not exist'
    );
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('uses custom distDir and branch options', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(true); // build dir
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runDeployToGitHubPages(cwd, {
      skipBuild: true,
      distDir: 'build',
      branch: 'pages',
    });

    expect(mockExeca).toHaveBeenCalledWith('npx', ['gh-pages', '-d', 'build', '-b', 'pages'], {
      cwd,
      stdio: 'inherit',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deploying "build" to GitHub Pages (branch: pages)')
    );
  });

  it('propagates build failure', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(false); // pnpm-lock.yaml
    mockReadJson.mockResolvedValueOnce({
      scripts: { build: 'webpack' },
    });
    mockExeca.mockRejectedValueOnce(new Error('Build failed'));

    await expect(runDeployToGitHubPages(cwd, { skipBuild: false })).rejects.toThrow(
      'Build failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1);
  });

  it('propagates gh-pages deploy failure', async () => {
    mockPathExists
      .mockResolvedValueOnce(true) // package.json
      .mockResolvedValueOnce(true) // .git
      .mockResolvedValueOnce(true); // dist
    mockExeca.mockRejectedValueOnce(new Error('Deploy failed'));

    await expect(runDeployToGitHubPages(cwd, { skipBuild: true })).rejects.toThrow(
      'Deploy failed'
    );
    expect(mockExeca).toHaveBeenCalledTimes(1);
  });
});
