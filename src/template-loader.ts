import fs from 'fs-extra';
import path from 'path';
import type { Template } from './templates.js';

export function loadCustomTemplates(filePath: string): Template[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Template file not found: ${resolved}\n`);
    process.exit(1);
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`❌ Invalid JSON in template file: ${resolved}\n`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`❌ Template file must be a JSON array of templates.\n`);
    process.exit(1);
  }
  const result: Template[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      console.error(`❌ Template at index ${i}: must be an object.\n`);
      process.exit(1);
    }
    const obj = item as Record<string, unknown>;
    const name = obj['name'];
    const description = obj['description'];
    const repo = obj['repo'];
    if (typeof name !== 'string' || !name.trim()) {
      console.error(`❌ Template at index ${i}: "name" must be a non-empty string.\n`);
      process.exit(1);
    }
    if (typeof description !== 'string') {
      console.error(`❌ Template at index ${i}: "description" must be a string.\n`);
      process.exit(1);
    }
    if (typeof repo !== 'string' || !repo.trim()) {
      console.error(`❌ Template at index ${i}: "repo" must be a non-empty string.\n`);
      process.exit(1);
    }
    const options = obj['options'];
    const packageManager = obj['packageManager'];
    if (options !== undefined && (!Array.isArray(options) || options.some((o) => typeof o !== 'string'))) {
      console.error(`❌ Template at index ${i}: "options" must be an array of strings.\n`);
      process.exit(1);
    }
    if (packageManager !== undefined && typeof packageManager !== 'string') {
      console.error(`❌ Template at index ${i}: "packageManager" must be a string.\n`);
      process.exit(1);
    }
    result.push({
      name: name.trim(),
      description: String(description),
      repo: repo.trim(),
      ...(Array.isArray(options) && options.length > 0 && { options: options as string[] }),
      ...(typeof packageManager === 'string' && packageManager.length > 0 && { packageManager }),
    });
  }
  return result;
}

export function mergeTemplates(builtIn: Template[], customFilePath?: string): Template[] {
  if (!customFilePath) {
    return builtIn;
  }
  const custom = loadCustomTemplates(customFilePath);
  const byName = new Map<string, Template>();
  builtIn.forEach((t) => byName.set(t.name, t));
  custom.forEach((t) => byName.set(t.name, t));
  return [...byName.values()];
}
