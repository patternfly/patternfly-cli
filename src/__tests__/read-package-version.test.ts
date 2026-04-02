import path from 'path';
import fs from 'fs-extra';
import { readPackageVersion } from '../read-package-version.js';

/** Repo root package.json (stable under Jest + ts-jest CommonJS emit; avoids cwd brittleness). */
const repoPackageJson = path.join(__dirname, '../../package.json');

describe('readPackageVersion', () => {
  it('returns the version from the repo package.json', () => {
    const pkg = fs.readJsonSync(repoPackageJson) as { version: string };

    expect(readPackageVersion(repoPackageJson)).toBe(pkg.version);
    expect(pkg.version.length).toBeGreaterThan(0);
  });

  it("returns 'unknown' when the file does not exist", () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const missing = path.join(path.dirname(repoPackageJson), 'nonexistent-package-xyz.json');
    try {
      expect(readPackageVersion(missing)).toBe('unknown');
    } finally {
      log.mockRestore();
    }
  });
});
