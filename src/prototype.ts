import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import inquirer from 'inquirer';

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
 * Find the main App.tsx or App.jsx file in a React application.
 */
async function findAppFile(cwd: string): Promise<string | null> {
  const patterns = [
    'src/App.tsx',
    'src/App.jsx',
    'App.tsx',
    'App.jsx',
  ];

  // Try exact matches first
  for (const pattern of patterns) {
    const fullPath = path.join(cwd, pattern);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
  }

  // If no exact match, search with glob
  const globPattern = '**/App.{tsx,jsx}';
  const matches = await glob(globPattern, {
    cwd,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });

  if (matches.length > 0) {
    const srcMatch = matches.find(m => m.includes('/src/'));
    return srcMatch ?? matches[0] ?? null;
  }

  return null;
}

/**
 * Check if ProtoBanner import already exists in the file.
 */
function hasProtoBannerImport(content: string): boolean {
  return content.includes("from '@patternfly/patternfly-cli'") && content.includes('ProtoBanner');
}

/**
 * Add ProtoBanner import statement to the file.
 */
function addProtoBannerImport(content: string): string {
  if (hasProtoBannerImport(content)) {
    return content;
  }

  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  const insertIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
  lines.splice(insertIndex, 0, "import { ProtoBanner } from '@patternfly/patternfly-cli';");

  return lines.join('\n');
}

/**
 * Insert ProtoBanner component at the beginning of the App component's return statement.
 */
function insertProtoBanner(content: string, customMessage: string): string {
  if (content.includes('<ProtoBanner')) {
    return content;
  }

  const messageAttribute = customMessage ? ` message="${customMessage}"` : '';
  const bannerElement = `<ProtoBanner${messageAttribute} />`;

  // Find return statement with JSX
  const lines = content.split('\n');
  let returnFound = false;
  let insertIndex = -1;
  let indentation = '      ';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    if (!returnFound && line.includes('return')) {
      returnFound = true;
    }
    if (returnFound && line.trim().startsWith('<') && !line.includes('</')) {
      insertIndex = i + 1;
      // Detect indentation from the next line if possible
      const nextLine = lines[i + 1];
      if (nextLine) {
        const match = nextLine.match(/^(\s+)/);
        if (match) {
          indentation = match[1];
        }
      }
      break;
    }
  }

  if (insertIndex > 0) {
    lines.splice(insertIndex, 0, `${indentation}${bannerElement}`);
    return lines.join('\n');
  }

  return content;
}

/**
 * Run the prototype command: find the main index file, add the CSS import, and insert ProtoBanner.
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

  // Prompt user for custom banner message
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'bannerMessage',
      message: 'Enter a custom message for the prototype banner (press Enter for default):',
      default: '',
    },
  ]);

  const customMessage = answers.bannerMessage.trim();

  if (customMessage) {
    console.log(`📝 Using custom banner message: "${customMessage}"\n`);
  } else {
    console.log('📝 Using default banner message: "This application is a design prototype"\n');
  }

  // Read the index file content
  const indexContent = await fs.readFile(indexFile, 'utf-8');

  // Check if CSS import already exists
  if (!hasImport(indexContent)) {
    const updatedIndexContent = addImport(indexContent);
    await fs.writeFile(indexFile, updatedIndexContent, 'utf-8');
    console.log('✅ Added prototype CSS import to index file.');
    console.log(`   Import statement: ${CSS_IMPORT_STATEMENT}\n`);
  } else {
    console.log('ℹ️  Prototype CSS import already exists in index file.\n');
  }

  // Find and update App file
  console.log('🔍 Searching for App component file...\n');
  const appFile = await findAppFile(cwd);

  if (!appFile) {
    console.log('⚠️  Could not find App.tsx or App.jsx file.');
    console.log('   You will need to manually add <ProtoBanner /> to your main component.\n');
    console.log('✨ Prototype mode CSS enabled! All UI will now render in grayscale. ✨\n');
    return;
  }

  console.log(`✅ Found App file: ${path.relative(cwd, appFile)}\n`);

  // Read App file content
  let appContent = await fs.readFile(appFile, 'utf-8');

  // Add ProtoBanner import if not present
  if (!hasProtoBannerImport(appContent)) {
    appContent = addProtoBannerImport(appContent);
    console.log('✅ Added ProtoBanner import to App file.');
  } else {
    console.log('ℹ️  ProtoBanner import already exists in App file.');
  }

  // Insert ProtoBanner component
  const updatedAppContent = insertProtoBanner(appContent, customMessage);

  if (updatedAppContent !== appContent) {
    await fs.writeFile(appFile, updatedAppContent, 'utf-8');
    console.log('✅ Added ProtoBanner component to App.\n');
  } else {
    console.log('ℹ️  ProtoBanner component already exists in App.\n');
  }

  console.log('✨ Prototype mode enabled! All UI will now render in grayscale with banner. ✨\n');
}
