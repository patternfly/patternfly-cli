/* eslint-disable @typescript-eslint/no-explicit-any */
import { runBumpPrerelease } from '../bump-prerelease';
import { execa } from 'execa';

jest.mock('execa');

const mockedExeca = execa as jest.MockedFunction<typeof execa>;

describe('runBumpPrerelease', () => {
  const mockCwd = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  it('should create initial prerelease tag if no tags exist', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        return Promise.resolve({ stdout: '' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v1.0.0-prerelease.0'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'origin', 'prerelease-v1.0.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should increment minor version from existing tag', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'upstream\norigin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v5.0.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v5.0.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v5.1.0-prerelease.0'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'upstream', 'prerelease-v5.1.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should use upstream remote if available', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'upstream\norigin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v1.5.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v1.5.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    expect(mockedExeca).toHaveBeenCalledWith('git', ['fetch', 'upstream', '--tags'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'upstream', 'prerelease-v1.6.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should use origin remote if upstream does not exist', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v2.3.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v2.3.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    expect(mockedExeca).toHaveBeenCalledWith('git', ['fetch', 'origin', '--tags'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'origin', 'prerelease-v2.4.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should throw error if tag already exists', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v3.0.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v3.0.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        // Tag exists
        return Promise.resolve({ stdout: 'abc123' } as any);
      }
      return Promise.resolve({} as any);
    });

    await expect(runBumpPrerelease(mockCwd)).rejects.toThrow(
      'Tag prerelease-v3.1.0-prerelease.0 already exists'
    );
  });

  it('should handle double-digit minor versions correctly', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v5.99.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v5.99.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v5.100.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should select latest tag when multiple tags exist', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({
            stdout: 'prerelease-v1.0.0-prerelease.0\nprerelease-v2.0.0-prerelease.0\nprerelease-v2.1.0-prerelease.0',
          } as any);
        }
        return Promise.resolve({
          stdout: 'prerelease-v1.0.0-prerelease.0\nprerelease-v2.0.0-prerelease.0\nprerelease-v2.1.0-prerelease.0',
        } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd);

    // Should use v2.1.0 as the latest and increment to v2.2.0
    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v2.2.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should not create or push tag in dry run mode', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v4.0.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v4.0.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd, { dryRun: true });

    // Should NOT create tag
    expect(mockedExeca).not.toHaveBeenCalledWith('git', ['tag', expect.any(String)], expect.any(Object));
    // Should NOT push tag
    expect(mockedExeca).not.toHaveBeenCalledWith('git', ['push', expect.any(String), expect.any(String)], expect.any(Object));
  });

  it('should still fetch and check tags in dry run mode', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'upstream' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v3.5.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v3.5.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd, { dryRun: true });

    // Should still fetch tags
    expect(mockedExeca).toHaveBeenCalledWith('git', ['fetch', 'upstream', '--tags'], { cwd: mockCwd });
    // Should still check if tag exists
    expect(mockedExeca).toHaveBeenCalledWith('git', ['rev-parse', 'prerelease-v3.6.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should bump major version when major option is true', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v5.3.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v5.3.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd, { major: true });

    // Should bump major from 5 to 6, reset minor and patch to 0
    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v6.0.0-prerelease.0'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'origin', 'prerelease-v6.0.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should bump minor version by default when major option is false', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v5.3.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v5.3.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd, { major: false });

    // Should bump minor from 3 to 4, keep major at 5, reset patch to 0
    expect(mockedExeca).toHaveBeenCalledWith('git', ['tag', 'prerelease-v5.4.0-prerelease.0'], { cwd: mockCwd });
    expect(mockedExeca).toHaveBeenCalledWith('git', ['push', 'origin', 'prerelease-v5.4.0-prerelease.0'], { cwd: mockCwd });
  });

  it('should work with major version bump in dry run mode', async () => {
    mockedExeca.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'remote') {
        return Promise.resolve({ stdout: 'origin' } as any);
      }
      if (command === 'git' && args?.[0] === 'tag' && args?.[1] === '-l') {
        if (args.includes('--sort=version:refname')) {
          return Promise.resolve({ stdout: 'prerelease-v7.15.0-prerelease.0' } as any);
        }
        return Promise.resolve({ stdout: 'prerelease-v7.15.0-prerelease.0' } as any);
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({} as any);
    });

    await runBumpPrerelease(mockCwd, { major: true, dryRun: true });

    // Should check for v8.0.0 but not create or push
    expect(mockedExeca).toHaveBeenCalledWith('git', ['rev-parse', 'prerelease-v8.0.0-prerelease.0'], { cwd: mockCwd });
    expect(mockedExeca).not.toHaveBeenCalledWith('git', ['tag', expect.any(String)], expect.any(Object));
    expect(mockedExeca).not.toHaveBeenCalledWith('git', ['push', expect.any(String), expect.any(String)], expect.any(Object));
  });
});
