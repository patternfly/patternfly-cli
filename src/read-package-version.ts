import fs from 'fs-extra';

const FALLBACK = 'unknown'

function getVersion(packageJsonPath: string): string {
  return (fs.readJsonSync(packageJsonPath) as { version: string }).version;
}

/** Same as readPackageVersion but never throws; use for CLI bootstrap before commands run. */
export function readPackageVersion(packageJsonPath: string): string {
  try {
    const version = getVersion(packageJsonPath);
    if (typeof version === 'string' && version.length > 0) {
      return version;
    }
  } catch {
    console.log("Unable to load package.json to retrieve current cli version.")
  }
  return FALLBACK;
}
