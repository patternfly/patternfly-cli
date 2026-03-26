import { jest } from '@jest/globals';
import { execa } from 'execa';

// Mock execa
jest.mock('execa');

const mockedExeca = execa as jest.MockedFunction<typeof execa>;

describe('doctor command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.version
    Object.defineProperty(process, 'version', {
      value: 'v20.0.0',
      writable: true,
    });
  });

  it('should pass all checks when requirements are met', async () => {
    // Mock successful corepack and gh commands
    mockedExeca.mockResolvedValue({
      stdout: 'gh version 2.0.0',
      stderr: '',
      exitCode: 0,
    } as any);

    const { runDoctor } = await import('../doctor.js');
    await expect(runDoctor(false)).resolves.not.toThrow();
  });

  it('should detect when Node.js version is too old', async () => {
    Object.defineProperty(process, 'version', {
      value: 'v18.0.0',
      writable: true,
    });

    const { runDoctor } = await import('../doctor.js');
    await expect(runDoctor(false)).resolves.not.toThrow();
  });

  it('should detect when corepack is not enabled', async () => {
    mockedExeca.mockImplementation((command: string) => {
      if (command === 'corepack') {
        throw new Error('Command not found');
      }
      return Promise.resolve({
        stdout: 'gh version 2.0.0',
        stderr: '',
        exitCode: 0,
      } as any);
    });

    const { runDoctor } = await import('../doctor.js');
    await expect(runDoctor(false)).resolves.not.toThrow();
  });

  it('should detect when GitHub CLI is not installed', async () => {
    mockedExeca.mockImplementation((command: string) => {
      if (command === 'gh') {
        throw new Error('Command not found');
      }
      return Promise.resolve({
        stdout: '0.28.0',
        stderr: '',
        exitCode: 0,
      } as any);
    });

    const { runDoctor } = await import('../doctor.js');
    await expect(runDoctor(false)).resolves.not.toThrow();
  });
});
