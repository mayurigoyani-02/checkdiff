// src/runner/testRunner.ts
import { execSync } from 'child_process';

export interface TestResult {
  success: boolean;
  output: string;
  command: string;
}

export async function runTests(command: string, opts: { verbose?: boolean } = {}): Promise<TestResult> {
  if (!command || command.includes('echo "')) {
    return { success: true, output: command, command };
  }

  try {
    if (opts.verbose) console.log(`  exec: ${command}`);
    
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    return { success: true, output, command };
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || e.message;
    return { success: false, output, command };
  }
}