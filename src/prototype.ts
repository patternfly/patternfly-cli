import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';

const CSS_IMPORT_STATEMENT = "import '@patternfly/patternfly-cli/prototype.css';";

/**
 * Find the main index.tsx or index.jsx file in a React application.
 * Searches common locations like src/index.tsx, src/index.jsx, index.tsx, index.jsx.
 */
async function findMainIndexFile(cwd: string): Promise<string | null> {
  // Common patterns for React app entry points
  const patterns = [
    'src/index.tsx',
    'src/index.jsx',
    'index.tsx',
    'index.jsx',
  ];

  // Try exact matches first
  for (const pattern of patterns) {
    const fullPath = path.join(cwd, pattern);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
  }

  // If no exact match, search with glob for any index.tsx or index.jsx
  const globPattern = '**/index.{tsx,jsx}';
  const matches = await glob(globPattern, {
    cwd,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });

  if (matches.length > 0) {
    // Prefer files in src directory
    const srcMatch = matches.find(m => m.includes('/src/'));
    return srcMatch ?? matches[0] ?? null;
  }

  return null;
}

/**
 * Check if the CSS import already exists in the file content.
 */
function hasImport(content: string): boolean {
  return content.includes(CSS_IMPORT_STATEMENT);
}

/**
 * Add the CSS import to the top of the file, after any existing imports.
 */
function addImport(content: string): string {
  if (hasImport(content)) {
    return content;
  }

  const lines = content.split('\n');
  let lastImportIndex = -1;

  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  // Insert after the last import, or at the beginning if no imports found
  const insertIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
  lines.splice(insertIndex, 0, CSS_IMPORT_STATEMENT);

  return lines.join('\n');
}

/**
 * Run the prototype command: find the main index file and add the CSS import.
 */
export async function runPrototype(cwd: string): Promise<void> {
  console.log('🔍 Searching for main index file...\n');

  const indexFile = await findMainIndexFile(cwd);

  if (!indexFile) {
    console.error('❌ Could not find main index.tsx or index.jsx file.');
    console.error('   Searched in common locations like src/index.tsx, src/index.jsx\n');
    throw new Error('Main index file not found');
  }

  console.log(`✅ Found index file: ${path.relative(cwd, indexFile)}\n`);

  // Read the file content
  const content = await fs.readFile(indexFile, 'utf-8');

  // Check if import already exists
  if (hasImport(content)) {
    console.log('ℹ️  Prototype CSS import already exists in the file.\n');
    return;
  }

  // Add the import
  const updatedContent = addImport(content);

  // Write back to the file
  await fs.writeFile(indexFile, updatedContent, 'utf-8');

  console.log('✅ Added prototype CSS import to the file.');
  console.log(`   Import statement: ${CSS_IMPORT_STATEMENT}\n`);
  console.log('✨ Prototype mode enabled! All UI will now render in grayscale. ✨\n');
}
