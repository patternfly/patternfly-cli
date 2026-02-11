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

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}));

import fs from 'fs-extra';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { runSave } from '../save.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

const cwd = '/tmp/my-repo';

describe('runSave', () => {
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

    await expect(runSave(cwd)).rejects.toThrow('Not a git repository');
    expect(mockPathExists).toHaveBeenCalledWith(`${cwd}/.git`);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('This directory is not a git repository'),
    );
    expect(mockExeca).not.toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('logs "No changes to save" and returns when working tree is clean', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runSave(cwd);

    expect(mockExeca).toHaveBeenCalledTimes(1);
    expect(mockExeca).toHaveBeenCalledWith('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No changes to save'),
    );
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('logs "No changes to save" when status output is only whitespace', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: '  \n  ', stderr: '', exitCode: 0 });

    await runSave(cwd);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No changes to save'),
    );
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('prompts to save; when user says no, logs "Nothing has been saved"', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: ' M file.ts', stderr: '', exitCode: 0 });
    mockPrompt.mockResolvedValueOnce({ saveChanges: false });

    await runSave(cwd);

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(mockPrompt).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'confirm',
        name: 'saveChanges',
        message: expect.stringContaining('Would you like to save them?'),
      }),
    ]);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Nothing has been saved'),
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // only status, no add/commit/push
  });

  it('when user says yes but message is empty, logs "No message provided"', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: ' M file.ts', stderr: '', exitCode: 0 });
    mockPrompt
      .mockResolvedValueOnce({ saveChanges: true })
      .mockResolvedValueOnce({ message: '   ' });

    await runSave(cwd);

    expect(mockPrompt).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No message provided'),
    );
    expect(mockExeca).toHaveBeenCalledTimes(1); // only status
  });

  it('when user says yes and provides message, runs add, commit, push and logs success', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca
      .mockResolvedValueOnce({ stdout: ' M file.ts', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    mockPrompt
      .mockResolvedValueOnce({ saveChanges: true })
      .mockResolvedValueOnce({ message: 'Fix bug in save command' });

    await runSave(cwd);

    expect(mockExeca).toHaveBeenCalledTimes(4);
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'git', ['add', '.'], {
      cwd,
      stdio: 'inherit',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(3, 'git', [
      'commit',
      '-m',
      'Fix bug in save command',
    ], { cwd, stdio: 'inherit' });
    expect(mockExeca).toHaveBeenNthCalledWith(4, 'git', ['push'], {
      cwd,
      stdio: 'inherit',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Changes saved and pushed to GitHub successfully'),
    );
  });

  it('throws and logs push-failure message when push fails with exitCode 128', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca
      .mockResolvedValueOnce({ stdout: ' M file.ts', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(Object.assign(new Error('push failed'), { exitCode: 128 }));

    mockPrompt
      .mockResolvedValueOnce({ saveChanges: true })
      .mockResolvedValueOnce({ message: 'WIP' });

    await expect(runSave(cwd)).rejects.toMatchObject({ message: 'push failed' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Push failed'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('remote'),
    );
  });

  it('throws and logs generic failure when add/commit/push fails with other exitCode', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca
      .mockResolvedValueOnce({ stdout: ' M file.ts', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(Object.assign(new Error('add failed'), { exitCode: 1 }));

    mockPrompt
      .mockResolvedValueOnce({ saveChanges: true })
      .mockResolvedValueOnce({ message: 'WIP' });

    await expect(runSave(cwd)).rejects.toMatchObject({ message: 'add failed' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Save or push failed'),
    );
  });

  it('throws and logs error when execa throws without exitCode', async () => {
    mockPathExists.mockResolvedValue(true);
    mockExeca
      .mockResolvedValueOnce({ stdout: ' M file.ts', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(new Error('network error'));

    mockPrompt
      .mockResolvedValueOnce({ saveChanges: true })
      .mockResolvedValueOnce({ message: 'WIP' });

    await expect(runSave(cwd)).rejects.toThrow('network error');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('network error'),
    );
  });
});
