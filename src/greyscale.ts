import fs from 'fs-extra';
import path from 'path';

const GREYSCALE_CSS_CONTENT = `/* Auto-generated greyscale filter */
html {
  filter: grayscale(100%);
  -webkit-filter: grayscale(100%);
}
`;

const GREYSCALE_CSS_FILENAME = 'greyscale-filter.css';

/**
 * Apply greyscale filter by creating a CSS file and importing it into the React entry point
 */
export async function runGreyscale(entryPointPath: string, cwd: string): Promise<void> {
  const resolvedEntryPoint = path.resolve(cwd, entryPointPath);

  // Verify the entry point file exists
  if (!(await fs.pathExists(resolvedEntryPoint))) {
    throw new Error(`Entry point file not found: ${resolvedEntryPoint}`);
  }

  // Create the CSS file in the same directory as the entry point
  const entryDir = path.dirname(resolvedEntryPoint);
  const cssFilePath = path.join(entryDir, GREYSCALE_CSS_FILENAME);

  await fs.writeFile(cssFilePath, GREYSCALE_CSS_CONTENT, 'utf-8');
  console.log(`✅ Created greyscale filter CSS at: ${cssFilePath}`);

  // Read the entry point file
  const entryContent = await fs.readFile(resolvedEntryPoint, 'utf-8');

  // Check if the import already exists
  const importStatement = `import './${GREYSCALE_CSS_FILENAME}';`;
  if (entryContent.includes(importStatement) || entryContent.includes(GREYSCALE_CSS_FILENAME)) {
    console.log('ℹ️  Greyscale filter import already exists in entry point.');
    return;
  }

  // Add the import at the top of the file (after any existing imports)
  const lines = entryContent.split('\n');
  let insertIndex = 0;

  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('import{')) {
      insertIndex = i + 1;
    } else if (trimmedLine && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) {
      // Stop at the first non-comment, non-import line
      break;
    }
  }

  // Insert the import statement
  lines.splice(insertIndex, 0, importStatement);
  const updatedContent = lines.join('\n');

  await fs.writeFile(resolvedEntryPoint, updatedContent, 'utf-8');
  console.log(`✅ Added greyscale filter import to: ${resolvedEntryPoint}`);
  console.log('\n🎨 Greyscale filter applied successfully!');
}
