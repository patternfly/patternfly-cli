import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { runAddAiContext } from '../add-ai-context.js';

const bundledTransformPath = path.join(
  process.cwd(),
  'node_modules',
  '@patternfly',
  'context-for-ai',
  'codemod',
  'transform.js',
);

const bundledJscodeshiftPath = path.join(
  process.cwd(),
  'node_modules',
  'jscodeshift',
  'bin',
  'jscodeshift.js',
);

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('../cli-package-root.js', () => ({
  __esModule: true,
  getCliPackageRoot: () => process.cwd(),
}));

const mockExeca = execa as jest.MockedFunction<typeof execa>;

describe('runAddAiContext', () => {
  beforeEach(() => {
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<
      ReturnType<typeof execa>
    >);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('runs bundled jscodeshift with the context-for-ai transform on default src/', async () => {
    const cwd = await fs.mkdtemp(path.join(process.cwd(), 'add-ai-context-'));
    try {
      await fs.ensureDir(path.join(cwd, 'src'));
      await runAddAiContext({ cwd, transformPath: bundledTransformPath });

      expect(mockExeca).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = mockExeca.mock.calls[0];
      expect(cmd).toBe(process.execPath);
      expect(args[0]).toBe(bundledJscodeshiftPath);
      expect(args[1]).toBe('-t');
      expect(args[2]).toBe(bundledTransformPath);
      expect(args).toContain('--extensions=ts,tsx,js,jsx');
      expect(args).toContain('--parser=tsx');
      expect(args[args.length - 1]).toBe(path.join(cwd, 'src'));
      expect(opts).toEqual({ cwd, stdio: 'inherit' });
    } finally {
      await fs.remove(cwd);
    }
  });

  it('includes --dry when dryRun is true', async () => {
    const cwd = await fs.mkdtemp(path.join(process.cwd(), 'add-ai-context-dry-'));
    try {
      await fs.ensureDir(path.join(cwd, 'components'));
      await runAddAiContext({
        cwd,
        targetPath: 'components',
        dryRun: true,
        transformPath: bundledTransformPath,
      });

      const [, args] = mockExeca.mock.calls[0];
      const dryIdx = args.indexOf('--dry');
      expect(dryIdx).toBeGreaterThan(-1);
      expect(args[args.length - 1]).toBe(path.join(cwd, 'components'));
    } finally {
      await fs.remove(cwd);
    }
  });

  it('throws when the target path does not exist', async () => {
    const cwd = await fs.mkdtemp(path.join(process.cwd(), 'add-ai-context-missing-'));
    try {
      await expect(
        runAddAiContext({ cwd, targetPath: 'missing', transformPath: bundledTransformPath }),
      ).rejects.toThrow(/does not exist/);
      expect(mockExeca).not.toHaveBeenCalled();
    } finally {
      await fs.remove(cwd);
    }
  });

  it('throws when an explicit transformPath does not exist', async () => {
    const cwd = await fs.mkdtemp(path.join(process.cwd(), 'add-ai-context-bad-transform-'));
    try {
      await fs.ensureDir(path.join(cwd, 'src'));
      await expect(
        runAddAiContext({ cwd, transformPath: path.join(cwd, 'no-such-transform.js') }),
      ).rejects.toThrow(/Codemod transform not found/);
      expect(mockExeca).not.toHaveBeenCalled();
    } finally {
      await fs.remove(cwd);
    }
  });

  it('resolves the bundled codemod when transformPath is omitted (CLI package root from install)', async () => {
    const cwd = await fs.mkdtemp(path.join(process.cwd(), 'add-ai-context-default-'));
    try {
      await fs.ensureDir(path.join(cwd, 'src'));
      await runAddAiContext({ cwd });

      const [, args] = mockExeca.mock.calls[0];
      expect(args[0]).toBe(bundledJscodeshiftPath);
      expect(args[1]).toBe('-t');
      expect(args[2]).toBe(bundledTransformPath);
    } finally {
      await fs.remove(cwd);
    }
  });
});
