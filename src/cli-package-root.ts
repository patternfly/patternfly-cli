import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Directory containing patternfly-cli `package.json` (`dist/` is a child of this path).
 * Uses this module's URL so resolution works for `npm link`, global installs, and `npx`
 * without relying on `process.argv[1]`.
 */
export function getCliPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}
