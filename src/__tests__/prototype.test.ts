jest.mock('fs-extra', () => {
  const real = jest.requireActual<typeof import('fs-extra')>('fs-extra');
  return {
    __esModule: true,
    default: {
      pathExists: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      existsSync: real.existsSync,
      readFileSync: real.readFileSync,
    },
  };
});

jest.mock('glob', () => ({
  __esModule: true,
  glob: jest.fn(),
}));

import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import { runPrototype } from '../prototype.js';

const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists> & jest.Mock;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile> & jest.Mock;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile> & jest.Mock;
const mockGlob = glob as jest.MockedFunction<typeof glob> & jest.Mock;

describe('runPrototype', () => {
  const testCwd = '/test/project';
  const CSS_IMPORT = "import '@patternfly/patternfly-cli/prototype.css';";

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log and console.error during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should find and modify src/index.tsx', async () => {
    const indexPath = path.join(testCwd, 'src/index.tsx');
    const originalContent = `import React from 'react';\nimport ReactDOM from 'react-dom';\n\nReactDOM.render(<App />, document.getElementById('root'));`;
    const expectedContent = `import React from 'react';\nimport ReactDOM from 'react-dom';\n${CSS_IMPORT}\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockPathExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue(originalContent);
    mockWriteFile.mockResolvedValue(undefined);

    await runPrototype(testCwd);

    expect(mockPathExists).toHaveBeenCalledWith(indexPath);
    expect(mockReadFile).toHaveBeenCalledWith(indexPath, 'utf-8');
    expect(mockWriteFile).toHaveBeenCalledWith(indexPath, expectedContent, 'utf-8');
  });

  it('should find and modify src/index.jsx', async () => {
    const tsxPath = path.join(testCwd, 'src/index.tsx');
    const jsxPath = path.join(testCwd, 'src/index.jsx');
    const originalContent = `import React from 'react';\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockPathExists
      .mockResolvedValueOnce(false) // src/index.tsx doesn't exist
      .mockResolvedValueOnce(true); // src/index.jsx exists
    mockReadFile.mockResolvedValue(originalContent);
    mockWriteFile.mockResolvedValue(undefined);

    await runPrototype(testCwd);

    expect(mockPathExists).toHaveBeenCalledWith(tsxPath);
    expect(mockPathExists).toHaveBeenCalledWith(jsxPath);
    expect(mockReadFile).toHaveBeenCalledWith(jsxPath, 'utf-8');
  });

  it('should not modify file if import already exists', async () => {
    const indexPath = path.join(testCwd, 'src/index.tsx');
    const contentWithImport = `import React from 'react';\n${CSS_IMPORT}\nimport ReactDOM from 'react-dom';\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockPathExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue(contentWithImport);

    await runPrototype(testCwd);

    expect(mockReadFile).toHaveBeenCalledWith(indexPath, 'utf-8');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should add import at the beginning if no imports exist', async () => {
    const indexPath = path.join(testCwd, 'src/index.tsx');
    const originalContent = `const app = document.getElementById('root');\napp.innerHTML = 'Hello';`;
    const expectedContent = `${CSS_IMPORT}\nconst app = document.getElementById('root');\napp.innerHTML = 'Hello';`;

    mockPathExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue(originalContent);
    mockWriteFile.mockResolvedValue(undefined);

    await runPrototype(testCwd);

    expect(mockWriteFile).toHaveBeenCalledWith(indexPath, expectedContent, 'utf-8');
  });

  it('should throw error if no index file is found', async () => {
    mockPathExists.mockResolvedValue(false);
    mockGlob.mockResolvedValue([]);

    await expect(runPrototype(testCwd)).rejects.toThrow('Main index file not found');

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should use glob to find index file if common locations do not exist', async () => {
    const foundIndexPath = path.join(testCwd, 'app/index.tsx');
    const originalContent = `import React from 'react';\n\nfunction App() { return <div>Hello</div>; }`;

    mockPathExists.mockResolvedValue(false);
    mockGlob.mockResolvedValue([foundIndexPath]);
    mockReadFile.mockResolvedValue(originalContent);
    mockWriteFile.mockResolvedValue(undefined);

    await runPrototype(testCwd);

    expect(mockGlob).toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith(foundIndexPath, 'utf-8');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should prefer src directory when multiple index files are found', async () => {
    const srcIndexPath = path.join(testCwd, 'src/index.tsx');
    const otherIndexPath = path.join(testCwd, 'other/index.tsx');
    const originalContent = `import React from 'react';`;

    mockPathExists.mockResolvedValue(false);
    mockGlob.mockResolvedValue([otherIndexPath, srcIndexPath]);
    mockReadFile.mockResolvedValue(originalContent);
    mockWriteFile.mockResolvedValue(undefined);

    await runPrototype(testCwd);

    expect(mockReadFile).toHaveBeenCalledWith(srcIndexPath, 'utf-8');
  });
});
