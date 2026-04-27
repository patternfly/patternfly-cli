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

import fs from 'fs-extra';
import { execa } from 'execa';
import { runLoad } from '../src/load.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;

const cwd = '/tmp/my-repo';

describe('runLoad', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('throws and logs error when .git directory does not exist', async () => {
    mockPathExists.mockResolvedValue(false);

    await expect(runLoad(cwd)).rejects.toThrow('Not a git repository');
    expect(mockPathExists).toHaveBeenCalledWith(`${cwd}/.git`);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('This directory is not a git repository'),
    );
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('runs git pull and logs success when repo exists', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    await runLoad(cwd);

    expect(mockExeca).toHaveBeenCalledTimes(1);
    expect(mockExeca).toHaveBeenCalledWith('git', ['pull'], {
      cwd,
      stdio: 'inherit',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pulling latest updates from GitHub'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Latest updates loaded successfully'),
    );
  });

  it('throws and logs pull-failure message when pull fails with exitCode 128', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockRejectedValueOnce(Object.assign(new Error('pull failed'), { exitCode: 128 }));

    await expect(runLoad(cwd)).rejects.toMatchObject({ message: 'pull failed' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pull failed'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('remote'),
    );
  });

  it('throws and logs generic failure when pull fails with other exitCode', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockRejectedValueOnce(Object.assign(new Error('pull failed'), { exitCode: 1 }));

    await expect(runLoad(cwd)).rejects.toMatchObject({ message: 'pull failed' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pull failed'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('See the output above'),
    );
  });

  it('throws and logs error when execa throws without exitCode', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockRejectedValueOnce(new Error('network error'));

    await expect(runLoad(cwd)).rejects.toThrow('network error');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('network error'),
    );
  });
});
