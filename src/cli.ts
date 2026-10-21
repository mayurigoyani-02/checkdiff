#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import { checkdiff } from './index';

const program = new Command();

program
  .name('checkdiff')
  .description('AI-powered E2E test impact analysis - run only tests affected by your changes')
  .version('2.0.0');

program
  .command('run')
  .description('Run impacted E2E tests based on git diff')
  .option('--base <branch>', 'Base branch to compare against', 'origin/main')
  .option('--head <branch>', 'Head to compare', 'HEAD')
  .option('--ai', 'Enable AI semantic analysis (requires CHECKDIFF_AI_KEY)', false)
  .option('--dry', 'Dry run - show impact without running tests', false)
  .option('--verbose', 'Verbose logging', false)
  .option('--all', 'Force run all tests (bypass impact analysis)', false)
  .action(async (opts) => {
    try {
      if (opts.all) {
        console.log('▶ Running: npx playwright test (forced --all)\n');
        const { runTests } = await import('./runner/testRunner');
        await runTests('npx playwright test', { verbose: opts.verbose });
        return;
      }

      const result = await checkdiff({
        base: opts.base,
        head: opts.head,
        ai: opts.ai,
        dry: opts.dry,
        verbose: opts.verbose
      });

      if (result.testResult && !result.testResult.success) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error('\n❌ CheckDiff failed:', err.message);
      if (opts.verbose) console.error(err.stack);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze impact without running tests (alias for run --dry)')
  .option('--base <branch>', 'Base branch', 'origin/main')
  .option('--ai', 'Enable AI', false)
  .option('--verbose', 'Verbose', false)
  .action(async (opts) => {
    await checkdiff({ base: opts.base, ai: opts.ai, dry: true, verbose: opts.verbose });
  });

program
  .command('graph')
  .description('Show dependency graph for debugging')
  .option('--verbose', 'Verbose', false)
  .action(async (opts) => {
    const { buildGraph } = await import('./analyzer/graphBuilder');
    const graph = await buildGraph(process.cwd());
    console.log(`Graph: ${graph.fileToImports.size} files`);
    if (opts.verbose) {
      for (const [file, imports] of graph.fileToImports.entries()) {
        if (imports.size > 0) {
          console.log(`\n${file}:`);
          imports.forEach(i => console.log(`  -> ${i}`));
        }
      }
    }
  });

// Handle: npx checkdiff --base HEAD (without 'run' command) - backwards compat
if (process.argv.length > 2 && !['run', 'analyze', 'graph'].includes(process.argv[2])) {
  // Convert `npx checkdiff --base HEAD` to `npx checkdiff run --base HEAD`
  const args = process.argv.slice(2);
  program.parse(['node', 'cli.ts', 'run', ...args]);
} else {
  program.parse();
}