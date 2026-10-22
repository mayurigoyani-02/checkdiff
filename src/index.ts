import path from 'path';
import fs from 'fs';
import { collectDiff } from './collectors/gitCollector';
import { classifyChanges, ClassifiedChange } from './analyzer/changeClassifier';
import { buildTestProfiles, generatePlaywrightTestFile, TestProfile } from './profile/testProfileBuilder';
import { generateSwaggerCurl, generateBrowserLinks } from './runner/endpointRunner';
import { findAffectedTests } from './analyzer/graphBuilder';
import { runTests, TestResult } from './runner/testRunner';
import { resolveApiPort } from './utils/portResolver';

export interface CheckDiffOpts {
  base: string; head?: string; rootDir: string;
  port?: number; apiUrl?: string; websitePort?: number;
  generateProfiles?: boolean; ai?: boolean; verbose?: boolean; dry?: boolean;
  autoRun?: boolean; report?: boolean; reportPath?: string;
}

export interface CheckDiffResult {
  classified: ClassifiedChange[]; profiles: TestProfile[];
  command: string; testResult?: TestResult; apiUrl: string; port: number;
  reportPath?: string; executionResults?: any[];
}

export async function checkdiff(opts: CheckDiffOpts): Promise<CheckDiffResult> {
  const resolved = resolveApiPort(opts.rootDir, opts.port) || { port: 4000, baseUrl: 'http://localhost:4000', config: {} as any };
  const apiUrl = opts.apiUrl || resolved.baseUrl || 'http://localhost:4000';
  const port = opts.port || resolved.port || 4000;
  const config = resolved.config || {};

  console.log(`  Using API: ${apiUrl} (port ${port})`);

  const diff = await collectDiff({ base: opts.base, head: opts.head || 'HEAD', rootDir: opts.rootDir, verbose: opts.verbose });
  console.log(`✔ Found ${diff.files.length} changed files`);

  const classified = classifyChanges(diff.files, opts.rootDir);
  const profiles = buildTestProfiles(classified, opts.rootDir);
  
  for (const p of profiles) {
    console.log(`\n--- ${p.change.file} [${p.change.type}/${p.change.subType}] ---`);
    const links = generateBrowserLinks(p, opts.rootDir, apiUrl);
    console.log(`  Swagger: ${links.swagger}`);
    if (opts.verbose) console.log(`  Curl:\n${generateSwaggerCurl(p, opts.rootDir, apiUrl)}`);
    if (opts.generateProfiles) {
      const out = generatePlaywrightTestFile(p, `${opts.rootDir}/e2e/auto`, opts.rootDir, apiUrl);
      console.log(`  Generated: ${out}`);
    }
  }

  const graph = await findAffectedTests(diff.files, opts.rootDir);
  const tags = [...new Set(graph.affected.flatMap((t: any) => t.tags as string[]))].filter(t => t !== '@all');
  const command = tags.length === 0 ? 'npx playwright test' : `npx playwright test --grep "${tags.join('|')}"`;

  // === AUTO-RUN AND REPORT BEFORE TEST RUNNER ===
  let executionResults: any[] = [];
  if (opts.autoRun) {
    console.log(`\n🚀 Auto-running ${profiles.length} profiles against ${apiUrl}...`);
    const { autoRunProfiles } = await import('./runner/autoRunner');
    executionResults = await autoRunProfiles(profiles, apiUrl);
  }

  let reportPath = opts.reportPath || path.join(opts.rootDir, 'checkdiff-report.html');
  if (opts.report || opts.autoRun) {
    console.log(`\n📄 Generating report at: ${reportPath}`);
    const { generateHtmlReport } = await import('./report/htmlReport');
    try {
      generateHtmlReport({ classified, profiles, command, apiUrl, port } as any, executionResults, reportPath);
      console.log(`✅ Report generated: ${reportPath} Exists=${fs.existsSync(reportPath)}`);
    } catch (e: any) {
      console.error(`❌ Report failed: ${e.message}`);
      console.error(e.stack);
    }
  }

  let testResult: TestResult | undefined;
  if (!opts.dry) {
    testResult = await runTests(command, { verbose: opts.verbose });
  }

  return { classified, profiles, command, testResult, apiUrl, port, reportPath, executionResults };
}