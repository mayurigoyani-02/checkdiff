#!/usr/bin/env node
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
  .option('--dry', 'Dry run - dont execute tests', false)
  .option('--verbose', 'Verbose logs', false)
  .option('--generateProfiles', 'Generate auto test profiles', false)
  .option('--port <port>', 'API port (alias for --apiPort)', '')
  .option('--apiPort <port>', 'API port', '')
  .option('--apiUrl <url>', 'Full API baseUrl')
  .option('--websitePort <port>', 'Website port', '')
  .option('--autoRun', 'Auto-run test profiles against live API', false)
  .option('--report', 'Generate HTML report page', false)
  .option('--reportPath <path>', 'Report output path', '')
  .action(async (opts) => {
    try {
      const rootDir = path.resolve(opts.root);
      const portVal = opts.apiPort || opts.port || '';
      const portNum = portVal ? parseInt(portVal) : undefined;
      const reportPath = opts.reportPath ? path.resolve(opts.reportPath) : path.join(rootDir, 'checkdiff-report.html');
      
      const result = await checkdiff({
        base: opts.base,
        head: opts.head,
        rootDir,
        port: portNum,
        apiUrl: opts.apiUrl,
        websitePort: opts.websitePort ? parseInt(opts.websitePort) : undefined,
        ai: opts.ai,
        dry: true, // FORCE dry for report - dont run playwright test yet
        verbose: opts.verbose,
        generateProfiles: opts.generateProfiles,
        autoRun: opts.autoRun,
        report: opts.report,
        reportPath,
      } as any);

      console.log(`\nTest Profile: ${result.profiles.length} changes classified`);
      if ((result as any).reportPath) {
        console.log(`📄 Report: ${(result as any).reportPath}`);
        console.log(`Exists: ${require('fs').existsSync((result as any).reportPath)}`);
      }
    } catch (e: any) {
      console.error('Error:', e.message);
      console.error(e.stack);
      process.exit(1);
    }
  });

program.parse();