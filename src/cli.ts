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
  .option('--pr <link>', 'PR link: GitHub PR URL (https://github.com/owner/repo/pull/123) or number. Auto-detected from GITHUB_REF in CI. Required in CI when --requireWorkItem is set')
  .option('--workItem <link>', 'Work-item link: GitHub Issue URL or "#123"/"123", ADO URL or id "123", or Jira key "PROJ-123" (comma-separated for multiple). Required when CI enforces the check')
  .option('--requireWorkItem', 'Fail the run if no work item is linked (CI gate: PR must have a work item). Exit 2 when unlinked', false)
  .option('--base <branch>', 'Base branch (fallback when --pr not used)', 'main')
  .option('--head <commit>', 'Head commit (fallback when --pr not used)', 'HEAD')
  .option('--root <dir>', 'Root dir', process.cwd())
  // Deprecated aliases (still work, hidden from primary docs)
  .option('--repo <slug>', '[deprecated] Use URL form in --pr/--workItem. Override GitHub repo slug owner/repo', '')
  .option('--issue <refs>', '[deprecated] Use --workItem for GitHub Issues')
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
  .option('--publishToWorkItem', 'Upload the generated HTML report to the linked work item (GitHub Issue, ADO, Jira). Requires --report', false)
  .option('--no-learn', 'Disable context learning (learns by default)')
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
        workItem: opts.workItem,
        learn: opts.learn,
        pr: opts.pr,
        repo: opts.repo,
        issue: opts.issue,
        requireWorkItem: opts.requireWorkItem,
        publishToWorkItem: opts.publishToWorkItem,
      } as any);

      console.log(`\nTest Profile: ${result.profiles.length} changes classified`);
      if (result.context) {
        console.log(`🧠 Context: ${result.context.workItems.length} work item(s), ${result.context.gaps.length} gap(s), ${result.context.knowledgeAreas} learned area(s)`);
      }

      console.log(`\nTest Profile: ${result.profiles.length} changes classified`);
      if ((result as any).reportPath) {
        console.log(`📄 Report: ${(result as any).reportPath}`);
        console.log(`Exists: ${require('fs').existsSync((result as any).reportPath)}`);
      }
    } catch (e: any) {
      const exitCode = (e as any).exitCode || (e as any).code === 'REQUIRE_WORKITEM' ? 2 : 1;
      console.error('Error:', e.message);
      if (!e.exitCode) console.error(e.stack);
      process.exit(exitCode);
    }
  });

program.parse();