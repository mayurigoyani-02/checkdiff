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

      if (result.diff) {
        const d: any = result.diff;
        console.log(`\nDiff Report: source=${d.source} base=${d.base} head=${String(d.head).slice(0,12)} files=${d.files.length}${d.pr ? ` PR #${d.pr.number} ${d.pr.url}` : ''}`);
        if (d.files.length) console.log(`  Files: ${d.files.join(', ')}`);
      }
      if (result.context) {
        console.log(`🧠 Context: ${result.context.workItems.length} work item(s), ${result.context.gaps.length} gap(s)`);
        if (result.context.workItems.length) console.log(`  Work items: ${result.context.workItems.map((w:any) => `${w.source}:${w.id} ${w.title?.slice(0,60)} ${w.url||''}`).join('\n  ')}`);
      }
      console.log(`\nTest Profiles: ${result.profiles.length} file(s) • Gaps: ${result.context?.gaps?.length ?? 0}`);
      for (const p of result.profiles) {
        const grep = [...new Set(p.testCases.map(tc => tc.tag))].join('|');
        const cmd = grep ? `npx playwright test --grep "${grep}"` : result.command;
        console.log(`  • ${p.change.file} [${p.change.type}/${p.change.subType}] — ${p.testCases.length} case(s): ${p.testCases.slice(0,4).map(tc=>`${tc.method} ${tc.endpoint} ${tc.tag}`).join(', ')}${p.testCases.length>4?' …':''}`);
        console.log(`    Test profile link: ${cmd}`);
        console.log(`    Playwright link: ${cmd} --ui`);
      }
      if (result.context?.gaps?.length) {
        console.log(`\nGaps:`);
        for (const g of result.context.gaps.slice(0,10)) console.log(`  [${g.severity}] ${g.category}: ${g.message}`);
      }
      if (result.reportPath) {
        console.log(`\n📄 Reports:`);
        console.log(`  Diff/Report: ${result.reportPath}`);
        console.log(`  Browser: file:///${result.reportPath.replace(/\\/g,'/')}`);
      }
      if (result.command) {
        console.log(`\n▶ Playwright (filtered): ${result.command}`);
        console.log(`  Run: ${result.command} --ui`);
      }
    } catch (e: any) {
      const exitCode = (e as any).exitCode || (e as any).code === 'REQUIRE_WORKITEM' ? 2 : 1;
      console.error('Error:', e.message);
      if (!e.exitCode) console.error(e.stack);
      process.exit(exitCode);
    }
  });

program.parse();