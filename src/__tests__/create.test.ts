jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

jest.mock('fs-extra', () => {
  const real = jest.requireActual<typeof import('fs-extra')>('fs-extra');
  return {
    __esModule: true,
    default: {
      pathExists: jest.fn(),
      readJson: jest.fn(),
      writeJson: jest.fn(),
      remove: jest.fn(),
      existsSync: real.existsSync,
      readFileSync: real.readFileSync,
    },
  };
});

jest.mock('execa', () => ({
  __esModule: true,
  execa: jest.fn(),
}));

jest.mock('../github.js', () => ({
  ...jest.requireActual('../github.js'),
  offerAndCreateGitHubRepo: jest.fn(),
}));

import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { sanitizeRepoName, offerAndCreateGitHubRepo } from '../github.js';
import { runCreate } from '../create.js';
import { defaultTemplates } from '../templates.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
const mockReadJson = fs.readJson as jest.MockedFunction<typeof fs.readJson>;
const mockWriteJson = fs.writeJson as jest.MockedFunction<typeof fs.writeJson>;
const mockRemove = fs.remove as jest.MockedFunction<typeof fs.remove>;
const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
const mockOfferAndCreateGitHubRepo = offerAndCreateGitHubRepo as jest.MockedFunction<
  typeof offerAndCreateGitHubRepo
>;

const projectDir = 'my-test-project';
const projectPath = path.resolve(projectDir);

const projectData = {
  name: 'my-app',
  version: '1.0.0',
  description: 'Test app',
  author: 'Test Author',
};

function setupHappyPathMocks() {
  mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>);
  mockPathExists.mockResolvedValue(true);
  mockReadJson.mockResolvedValue({ name: 'template-name', version: '0.0.0' });
  mockWriteJson.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  mockOfferAndCreateGitHubRepo.mockResolvedValue(undefined);
  mockPrompt.mockResolvedValue(projectData);
  return projectData;
}

describe('GitHub support (create command)', () => {
  it('derives repo name from package name the same way the create command does', () => {
    expect(sanitizeRepoName('my-app')).toBe('my-app');
    expect(sanitizeRepoName('@patternfly/my-project')).toBe('my-project');
    expect(sanitizeRepoName('My Project Name')).toBe('my-project-name');
  });

  it('builds repo URL in the format used by the create command', () => {
    const username = 'testuser';
    const repoName = sanitizeRepoName('@org/my-package');
    const repoUrl = `https://github.com/${username}/${repoName}`;
    expect(repoUrl).toBe('https://github.com/testuser/my-package');
  });
});

describe('runCreate', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('throws when template name is not found', async () => {
    await expect(runCreate(projectDir, 'nonexistent-template')).rejects.toThrow(
      'Template "nonexistent-template" not found'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Template "nonexistent-template" not found')
    );
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('prompts for project directory when not provided', async () => {
    setupHappyPathMocks();

    await runCreate(undefined, 'starter');

    expect(mockPrompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'input',
          name: 'projectDirectory',
          message: expect.stringContaining('directory where you want to create the project'),
          default: 'my-app',
        }),
      ])
    );
  });

  it('prompts for template when not provided', async () => {
    setupHappyPathMocks();
    mockPrompt
      .mockResolvedValueOnce({ templateName: 'starter' })
      .mockResolvedValueOnce(projectData);

    await runCreate(projectDir, undefined);

    expect(mockPrompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'list',
          name: 'templateName',
          message: 'Select a template:',
          choices: expect.any(Array),
        }),
      ])
    );
  });

  it('uses HTTPS repo URL when ssh option is false', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter', { ssh: false });

    const starter = defaultTemplates.find(t => t.name === 'starter');
    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'git',
      ['clone', starter!.repo, projectPath],
      expect.objectContaining({ stdio: 'inherit' })
    );
  });

  it('uses SSH repo URL when ssh option is true and template has repoSSH', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter', { ssh: true });

    const starter = defaultTemplates.find(t => t.name === 'starter');
    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'git',
      ['clone', starter!.repoSSH, projectPath],
      expect.objectContaining({ stdio: 'inherit' })
    );
  });

  it('passes template clone options to git clone', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'compass-starter');

    const compass = defaultTemplates.find(t => t.name === 'compass-starter');
    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'git',
      ['clone', ...compass!.options!, compass!.repo, projectPath],
      expect.any(Object)
    );
  });

  it('removes .git from cloned project and customizes package.json', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter');

    expect(mockRemove).toHaveBeenCalledWith(path.join(projectPath, '.git'));
    expect(mockReadJson).toHaveBeenCalledWith(path.join(projectPath, 'package.json'));
    expect(mockWriteJson).toHaveBeenCalledWith(
      path.join(projectPath, 'package.json'),
      expect.objectContaining({
        name: projectData.name,
        version: projectData.version,
        description: projectData.description,
        author: projectData.author,
      }),
      { spaces: 2 }
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Customized package.json'));
  });

  it('skips package.json customization when package.json does not exist', async () => {
    setupHappyPathMocks();
    mockPathExists.mockResolvedValue(false);

    await runCreate(projectDir, 'starter');

    expect(mockReadJson).not.toHaveBeenCalled();
    expect(mockWriteJson).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No package.json found in template')
    );
  });

  it('uses template packageManager and runs install', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter');

    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      'yarn',
      ['install'],
      expect.objectContaining({ cwd: projectPath, stdio: 'inherit' })
    );
  });

  it('falls back to npm when template has no packageManager', async () => {
    setupHappyPathMocks();
    // rhoai_enabled_starter has no packageManager
    const rhoai = defaultTemplates.find(t => t.name === 'rhoai_enabled_starter');
    expect(rhoai?.packageManager).toBeUndefined();

    await runCreate(projectDir, 'rhoai_enabled_starter');

    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['install'],
      expect.objectContaining({ cwd: projectPath, stdio: 'inherit' })
    );
  });

  it('calls offerAndCreateGitHubRepo after install', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter');

    expect(mockOfferAndCreateGitHubRepo).toHaveBeenCalledWith(projectPath);
  });

  it('logs success message with project directory', async () => {
    setupHappyPathMocks();

    await runCreate(projectDir, 'starter');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Project created successfully'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`cd ${projectDir}`));
  });

  it('cleans up project directory and rethrows when clone fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('clone failed'));
    mockPathExists.mockResolvedValue(true);

    await expect(runCreate(projectDir, 'starter')).rejects.toThrow('clone failed');

    expect(mockRemove).toHaveBeenCalledWith(projectPath);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned up failed project directory'));
  });

  it('cleans up project directory and rethrows when install fails', async () => {
    mockExeca
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as Awaited<ReturnType<typeof execa>>)
      .mockRejectedValueOnce(new Error('install failed'));
    mockPathExists.mockResolvedValue(true);
    mockReadJson.mockResolvedValue({});
    mockWriteJson.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockPrompt.mockResolvedValue(projectData);

    await expect(runCreate(projectDir, 'starter')).rejects.toThrow('install failed');

    expect(mockRemove).toHaveBeenCalledWith(projectPath);
  });

  it('uses custom templates when templateFile option is provided', async () => {
    const fixturesDir = path.join(process.cwd(), 'src', '__tests__', 'fixtures');
    const customPath = path.join(fixturesDir, 'valid-templates.json');
    setupHappyPathMocks();
    mockPrompt.mockResolvedValueOnce(projectData);

    await runCreate(projectDir, 'custom-one', { templateFile: customPath });

    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'git',
      ['clone', 'https://github.com/example/custom-one.git', projectPath],
      expect.any(Object)
    );
  });
});
