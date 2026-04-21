import fs from 'fs-extra';
import path from 'path';
import { runGreyscale } from '../greyscale.js';

jest.mock('fs-extra');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('runGreyscale', () => {
  const cwd = '/test/project';
  const entryPoint = 'src/index.tsx';
  const resolvedEntryPoint = path.resolve(cwd, entryPoint);
  const cssFilePath = path.join(path.dirname(resolvedEntryPoint), 'greyscale-filter.css');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create CSS file and add import to entry point', async () => {
    const entryContent = `import React from 'react';\nimport ReactDOM from 'react-dom';\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue(entryContent);
    mockFs.writeFile.mockResolvedValue(undefined);

    await runGreyscale(entryPoint, cwd);

    // Verify CSS file was created
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      cssFilePath,
      expect.stringContaining('filter: grayscale(100%)'),
      'utf-8'
    );

    // Verify import was added to entry point
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      resolvedEntryPoint,
      expect.stringContaining("import './greyscale-filter.css';"),
      'utf-8'
    );
  });

  it('should throw error if entry point does not exist', async () => {
    mockFs.pathExists.mockResolvedValue(false);

    await expect(runGreyscale(entryPoint, cwd)).rejects.toThrow(
      `Entry point file not found: ${resolvedEntryPoint}`
    );
  });

  it('should not add duplicate import if already exists', async () => {
    const entryContent = `import './greyscale-filter.css';\nimport React from 'react';\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue(entryContent);
    mockFs.writeFile.mockResolvedValue(undefined);

    await runGreyscale(entryPoint, cwd);

    // CSS file should still be created
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      cssFilePath,
      expect.any(String),
      'utf-8'
    );

    // Entry point should NOT be modified (only 1 writeFile call for CSS)
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('should insert import after existing imports', async () => {
    const entryContent = `import React from 'react';\nimport ReactDOM from 'react-dom';\nimport './App.css';\n\nReactDOM.render(<App />, document.getElementById('root'));`;

    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue(entryContent);
    mockFs.writeFile.mockResolvedValue(undefined);

    await runGreyscale(entryPoint, cwd);

    // Verify the import is added after existing imports
    const updatedContent = (mockFs.writeFile.mock.calls.find(
      call => call[0] === resolvedEntryPoint
    )?.[1] as string) || '';

    expect(updatedContent).toContain("import './greyscale-filter.css';");

    // Verify it's inserted after the last import
    const lines = updatedContent.split('\n');
    const greyscaleImportIndex = lines.findIndex(line =>
      line.includes("import './greyscale-filter.css';")
    );
    const lastOriginalImportIndex = lines.findIndex(line =>
      line.includes("import './App.css';")
    );

    expect(greyscaleImportIndex).toBeGreaterThan(lastOriginalImportIndex);
  });
});
