// src/index.ts
import { collectDiff, DiffResult } from './collectors/gitCollector';
import { mapImpact, ImpactResult } from './mapper/impactMapper';
import { runTests, TestResult } from './runner/testRunner';

export interface CheckDiffOptions {
  base?: string;           // default: origin/main
  head?: string;           // default: HEAD
  ai?: boolean;            // enable AI semantic layer
  dry?: boolean;           // don't run tests, just show impact
  verbose?: boolean;
}

export interface CheckDiffResult {
  diff: DiffResult;
  impact: ImpactResult;
  testResult?: TestResult;
}

export async function checkdiff(options: CheckDiffOptions = {}): Promise<CheckDiffResult> {
  const base = options.base || 'origin/main';
  const head = options.head || 'HEAD';

  // STEP 1: gitCollector - Get changed files from git
  // This is where your "Found 6 changed files" log comes from
  if (options.verbose) console.log(`\n🔍 Collecting diff ${base}...${head}`);
  const diff = await collectDiff({ base, head, verbose: options.verbose });
  
  if (diff.files.length === 0) {
    console.log('✔ No changes detected');
    return { diff, impact: { tags: [], files: [], reason: 'No changes', command: 'echo "skip"' } };
  }

  console.log(`✔ Found ${diff.files.length} changed files`);
  if (options.verbose) {
    diff.files.forEach(f => console.log(`  - ${f}`));
  }

  // STEP 2: impactMapper - Graph + AI decides which tests
  // No checkdiff.config.js - auto-detected
  const impact = await mapImpact(diff, {
    ai: options.ai,
    rootDir: process.cwd(),
    verbose: options.verbose
  });

  console.log(`\nImpact: ${impact.tags.length ? impact.tags.join(', ') : 'none'}`);
  console.log(`Reason: ${impact.reason}`);
  console.log(`\nTest Profile: ${impact.files.length} files, ${impact.tags.join(' ') || 'no impact'}`);
  console.log(`\n▶ Running: ${impact.command}\n`);

  if (options.dry) {
    return { diff, impact };
  }

  // STEP 3: testRunner - Run impacted tests
  const testResult = await runTests(impact.command, { verbose: options.verbose });

  if (!testResult.success) {
    console.error('\n❌ Impacted tests failed');
    if (options.verbose) console.error(testResult.output);
  } else {
    console.log('\n✔ Impacted tests passed');
  }

  return { diff, impact, testResult };
}

// For programmatic use
export { collectDiff } from './collectors/gitCollector';
export { mapImpact } from './mapper/impactMapper';
export { runTests } from './runner/testRunner';