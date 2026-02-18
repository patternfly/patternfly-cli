export function handleGitError(err: unknown, operation: string, message: string): void {
  const withExitCode = err && err instanceof Error && 'exitCode' in err;
  if (withExitCode) {
    const code = err.exitCode;
    if (code === 128) {
      console.error(`\n❌ ${operation} failed. ${message}`);
    } else {
      console.error(`\n❌ ${operation} failed. See the output above for details.\n`);
    }
  } else {
    console.error('\n❌ An error occurred:');
    if (err instanceof Error) console.error(`   ${err.message}\n`);
    else console.error(`   ${String(err)}\n`);
  }
  throw err;
}