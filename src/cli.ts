// src/cli.ts - FIXED TYPES
import { Command } from 'commander';
import { checkdiff } from './index';
import path from 'path';

const program = new Command();

program
  .name('checkdiff')
  .description('Check diff and run impacted tests with profiles')
  .version('2.0.0');

program
  .command('run')
  .option('--base <branch>', 'Base branch', 'main')
  .option('--head <commit>', 'Head commit', 'HEAD')
  .option('--root <dir>', 'Root dir', process.cwd())
  .option('--ai', 'Enable AI impact', false)
  .option('--dry', 'Dry run - don\'t execute tests', false)
  .option('--verbose', 'Verbose logs', false)
  .option('--generateProfiles', 'Generate auto test profiles', false)
  .option('--port <port>', 'API port (service passes to CheckDiff)', '4000')
  .option('--apiUrl <url>', 'Full API baseUrl, e.g. http://localhost:4000')
  .option('--websitePort <port>', 'Website port', '3000')
  .action(async (opts) => {
    try {
      const rootDir = path.resolve(opts.root);    
      const { resolveApiPort } = await import('./utils/portResolver');
      const { port, baseUrl, config } = resolveApiPort(rootDir, opts.port ? parseInt(opts.port) : undefined);
      // If apiUrl passed via CLI, override
      const finalBaseUrl = opts.apiUrl || config.api?.baseUrl || baseUrl;
      const finalPort = opts.apiUrl ? new URL(opts.apiUrl).port : port;
      console.log(`  API: ${finalBaseUrl} (port ${finalPort}) - from ${opts.apiUrl ? 'CLI' : config.api ? 'checkdiff.config.js' : '.env/auto'}`);

      const result = await checkdiff({
        base: opts.base,
        head: opts.head,
        rootDir,
        apiUrl: finalBaseUrl,
        port: finalPort as any,
        ai: opts.ai,
        dry: opts.dry,
        verbose: opts.verbose,
        generateProfiles: opts.generateProfiles,
      });

      console.log(`\nTest Profile: ${result.profiles.length} changes classified`);
      console.log(`\n▶ Running: ${result.command}`);

      if (result.testResult && !result.testResult.success) {
        console.log(result.testResult.output);
        process.exit(1);
      }
    } catch (e: any) {
      console.error('Error:', e.message);
      if (opts.verbose) console.error(e.stack);
      process.exit(1);
    }
  });

program
  .command('classify')
  .option('--base <branch>', 'Base branch', 'main')
  .option('--head <commit>', 'Head commit', 'HEAD')
  .option('--root <dir>', 'Root dir', process.cwd())
  .action(async (opts) => {
    const { collectDiff } = await import('./collectors/gitCollector');
    const { classifyChanges } = await import('./analyzer/changeClassifier');
    const diff = await collectDiff({ base: opts.base, head: opts.head, rootDir: path.resolve(opts.root) });
    const classified = classifyChanges(diff.files, path.resolve(opts.root));
    console.table(classified);
  });

program.parse();