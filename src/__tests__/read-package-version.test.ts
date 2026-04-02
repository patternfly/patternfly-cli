import path from 'path';
import fs from 'fs-extra';
import { readPackageVersion } from '../read-package-version.js';

describe('readPackageVersion', () => {
  it('returns the version from the repo package.json', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = fs.readJsonSync(pkgPath) as { version: string };

    expect(readPackageVersion(pkgPath)).toBe(pkg.version);
    expect(pkg.version.length).toBeGreaterThan(0);
  });
});
