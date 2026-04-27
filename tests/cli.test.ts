import path from 'path';
import fs from 'fs-extra';
import { loadCustomTemplates, mergeTemplates } from '../src/template-loader.js';
import templates from '../src/templates.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

describe('loadCustomTemplates', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as () => never);
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('loads and parses a valid template file', () => {
    const filePath = path.join(fixturesDir, 'valid-templates.json');
    const result = loadCustomTemplates(filePath);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'custom-one',
      description: 'A custom template',
      repo: 'https://github.com/example/custom-one.git',
    });
    expect(result[1]).toEqual({
      name: 'custom-with-options',
      description: 'Custom with clone options',
      repo: 'https://github.com/example/custom.git',
      options: ['--depth', '1'],
      packageManager: 'pnpm',
    });
  });

  it('exits when file does not exist', () => {
    const filePath = path.join(fixturesDir, 'nonexistent.json');

    expect(() => loadCustomTemplates(filePath)).toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Template file not found'),
    );
  });

  it('exits when file contains invalid JSON', async () => {
    const invalidPath = path.join(fixturesDir, 'invalid-json.txt');
    await fs.writeFile(invalidPath, 'not valid json {');

    try {
      expect(() => loadCustomTemplates(invalidPath)).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON'),
      );
    } finally {
      await fs.remove(invalidPath);
    }
  });

  it('exits when JSON is not an array', () => {
    const filePath = path.join(fixturesDir, 'not-array.json');

    expect(() => loadCustomTemplates(filePath)).toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a JSON array'),
    );
  });

  it('exits when template is missing required name', () => {
    const filePath = path.join(fixturesDir, 'invalid-template-missing-name.json');

    expect(() => loadCustomTemplates(filePath)).toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"name" must be'),
    );
  });

  it('exits when template has invalid options (non-string array)', () => {
    const filePath = path.join(fixturesDir, 'invalid-template-bad-options.json');

    expect(() => loadCustomTemplates(filePath)).toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"options" must be'),
    );
  });
});

describe('mergeTemplates', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as () => never);

  afterAll(() => {
    exitSpy.mockRestore();
  });
  it('returns built-in templates when no custom file path is provided', () => {
    const result = mergeTemplates(templates);

    expect(result).toEqual(templates);
    expect(result).toHaveLength(templates.length);
  });

  it('returns built-in templates when custom file path is undefined', () => {
    const result = mergeTemplates(templates, undefined);

    expect(result).toEqual(templates);
  });

  it('merges custom templates with built-in, custom overrides by name', () => {
    const customPath = path.join(fixturesDir, 'valid-templates.json');
    const result = mergeTemplates(templates, customPath);

    const names = result.map((t) => t.name);
    expect(names).toContain('custom-one');
    expect(names).toContain('custom-with-options');

    const customOne = result.find((t) => t.name === 'custom-one');
    expect(customOne?.repo).toBe('https://github.com/example/custom-one.git');
  });

  it('overrides built-in template when custom has same name', async () => {
    const builtInStarter = templates.find((t) => t.name === 'starter');
    expect(builtInStarter).toBeDefined();

    const customPath = path.join(fixturesDir, 'override-starter.json');
    await fs.writeJson(customPath, [
      {
        name: 'starter',
        description: 'Overridden starter',
        repo: 'https://github.com/custom/overridden-starter.git',
      },
    ]);

    try {
      const result = mergeTemplates(templates, customPath);
      const starter = result.find((t) => t.name === 'starter');
      expect(starter?.description).toBe('Overridden starter');
      expect(starter?.repo).toBe('https://github.com/custom/overridden-starter.git');
    } finally {
      await fs.remove(customPath);
    }
  });
});
