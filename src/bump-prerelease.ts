import { execa } from 'execa';

/**
 * Parse a prerelease tag (e.g., "prerelease-v5.0.0-prerelease.0")
 * Returns { major, minor, patch }
 */
function parsePrereleaseTag(tag: string): { major: number; minor: number; patch: number } {
  const match = tag.match(/^prerelease-v(\d+)\.(\d+)\.(\d+)-prerelease\.\d+$/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Tag "${tag}" is not in prerelease format (expected: prerelease-vX.Y.Z-prerelease.N)`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Get the name of the upstream remote (could be 'upstream' or 'origin')
 */
async function getUpstreamRemote(cwd: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['remote'], { cwd });
    const remotes = stdout.split('\n').map(r => r.trim()).filter(Boolean);

    if (remotes.includes('upstream')) {
      return 'upstream';
    }
    if (remotes.includes('origin')) {
      return 'origin';
    }
    throw new Error('No upstream or origin remote found');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to determine upstream remote: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get the latest prerelease tag from git
 */
async function getLatestPrereleaseTag(cwd: string, remote: string): Promise<string | null> {
  try {
    // Fetch tags from remote
    await execa('git', ['fetch', remote, '--tags'], { cwd });

    // Get all prerelease tags, sorted by version
    const { stdout } = await execa('git', ['tag', '-l', 'prerelease-v*'], { cwd });
    const tags = stdout.split('\n').filter(Boolean);

    if (tags.length === 0) {
      return null;
    }

    // Sort tags by version (using git's version sort)
    const { stdout: sortedTags } = await execa('git', ['tag', '-l', 'prerelease-v*', '--sort=version:refname'], { cwd });
    const sortedTagList = sortedTags.split('\n').filter(Boolean);

    return sortedTagList[sortedTagList.length - 1] || null;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get latest prerelease tag: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if a git tag already exists
 */
async function tagExists(tag: string, cwd: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', tag], { cwd });
    return true;
  } catch {
    return false;
  }
}

export interface BumpPrereleaseOptions {
  dryRun?: boolean;
  major?: boolean;
}

export async function runBumpPrerelease(cwd: string, options: BumpPrereleaseOptions = {}): Promise<void> {
  const { dryRun = false, major = false } = options;

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log(`🚀 Bumping prerelease ${major ? 'MAJOR' : 'minor'} version...\n`);

  const remote = await getUpstreamRemote(cwd);
  console.log(`📡 Using remote: ${remote}`);

  console.log('📥 Fetching tags...');
  const latestTag = await getLatestPrereleaseTag(cwd, remote);

  let newTag: string;

  if (!latestTag) {
    console.log('⚠️  No existing prerelease tags found.');
    console.log('Creating initial prerelease tag: prerelease-v1.0.0-prerelease.0\n');
    newTag = 'prerelease-v1.0.0-prerelease.0';
  } else {
    console.log(`📌 Latest prerelease tag: ${latestTag}`);

    const { major: currentMajor, minor: currentMinor } = parsePrereleaseTag(latestTag);

    let newVersion: string;
    if (major) {
      // Bump major version, reset minor and patch to 0
      const newMajor = currentMajor + 1;
      newVersion = `${newMajor}.0.0`;
    } else {
      // Bump minor version, reset patch to 0
      const newMinor = currentMinor + 1;
      newVersion = `${currentMajor}.${newMinor}.0`;
    }

    newTag = `prerelease-v${newVersion}-prerelease.0`;
    console.log(`🏷️  Next prerelease tag: ${newTag}\n`);
  }

  // Check if tag already exists
  if (await tagExists(newTag, cwd)) {
    throw new Error(`Tag ${newTag} already exists. Cannot create duplicate tag.`);
  }

  if (dryRun) {
    console.log(`\n📋 Summary (DRY RUN):`);
    console.log(`   Would create tag: ${newTag}`);
    console.log(`   Would push tag to: ${remote}`);
    console.log('\n💡 Run without --dry-run to actually create and push the tag.\n');
    return;
  }

  // Create the tag
  console.log(`Creating tag: ${newTag}`);
  await execa('git', ['tag', newTag], { cwd });
  console.log('✅ Tag created');

  // Push the tag
  console.log(`📤 Pushing tag to ${remote}...`);
  await execa('git', ['push', remote, newTag], { cwd });
  console.log(`✅ Tag pushed to ${remote}`);

  console.log('\n🎉 Done! Semantic-release should now start releasing from this tag.\n');
}
