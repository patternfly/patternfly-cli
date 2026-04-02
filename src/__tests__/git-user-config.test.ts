jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

import inquirer from 'inquirer';
import { execa } from 'execa';
import { promptAndSetLocalGitUser } from '../git-user-config.js';

const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;

describe('promptAndSetLocalGitUser', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('reads global defaults then sets local user.name and user.email', async () => {
    mockExeca
      .mockResolvedValueOnce({ stdout: 'Jane Doe\n', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>)
      .mockResolvedValueOnce({ stdout: 'jane@example.com\n', stderr: '', exitCode: 0 } as Awaited<
        ReturnType<typeof execa>
      >)
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);

    mockPrompt.mockResolvedValue({
      userName: '  Local Name  ',
      userEmail: ' local@example.com ',
    });

    await promptAndSetLocalGitUser('/tmp/proj');

    expect(mockExeca).toHaveBeenNthCalledWith(1, 'git', ['config', '--global', 'user.name'], {
      reject: false,
    });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'git', ['config', '--global', 'user.email'], {
      reject: false,
    });
    expect(mockExeca).toHaveBeenNthCalledWith(3, 'git', ['config', '--local', 'user.name', 'Local Name'], {
      cwd: '/tmp/proj',
      stdio: 'inherit',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(
      4,
      'git',
      ['config', '--local', 'user.email', 'local@example.com'],
      { cwd: '/tmp/proj', stdio: 'inherit' },
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Set local git user.name and user.email'),
    );
  });

  it('skips git config when name or email is empty after trim', async () => {
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);
    mockPrompt.mockResolvedValue({ userName: '', userEmail: 'a@b.com' });

    await promptAndSetLocalGitUser('/tmp/proj');

    expect(mockExeca).not.toHaveBeenCalledWith(
      'git',
      ['config', '--local', 'user.name', expect.any(String)],
      expect.any(Object),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Both user.name and user.email are required'),
    );
  });
});
