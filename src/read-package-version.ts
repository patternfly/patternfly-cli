import fs from 'fs-extra';

export function readPackageVersion(packageJsonPath: string): string {
  return (fs.readJsonSync(packageJsonPath) as { version: string }).version;
}
