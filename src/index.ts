// src/index.ts - FIXED, NO ERRORS
import { collectDiff } from './collectors/gitCollector';
import { classifyChanges, ClassifiedChange } from './analyzer/changeClassifier';
import { buildTestProfiles, generatePlaywrightTestFile, TestProfile } from './profile/testProfileBuilder';
import { generateSwaggerCurl, generateBrowserLinks } from './runner/endpointRunner';
import { findAffectedTests } from './analyzer/graphBuilder';
import { runTests, TestResult } from './runner/testRunner';
import { resolveApiPort } from './utils/portResolver';

export interface CheckDiffOpts {
  base: string;
  head?: string;
  rootDir: string;
  port?: number;
  apiUrl?: string;
  websitePort?: number;
  generateProfiles?: boolean;
  ai?: boolean;
  verbose?: boolean;
  dry?: boolean;
}

export interface CheckDiffResult {
  classified: ClassifiedChange[];
  profiles: TestProfile[];
  command: string;
  testResult?: TestResult;
  apiUrl: string;
  port: number;
}

export async function checkdiff(opts: CheckDiffOpts): Promise<CheckDiffResult> {
  // Resolve port - service passes it via config or CLI
  const resolved = resolveApiPort(opts.rootDir, opts.port);
  const apiUrl = opts.apiUrl || resolved.baseUrl;
  const port = opts.port || resolved.port;
  const config = resolved.config;

  console.log(`  Using API: ${apiUrl} (port ${port}) - from ${opts.apiUrl ? 'CLI --apiUrl' : config.api ? 'checkdiff.config.js' : '.env/default'}`);

  const diff = await collectDiff({ 
    base: opts.base, 
    head: opts.head || 'HEAD', 
    rootDir: opts.rootDir, 
    verbose: opts.verbose 
  });
  
  console.log(`✔ Found ${diff.files.length} changed files`);

  const classified = classifyChanges(diff.files, opts.rootDir);
  console.table(classified.map(c => ({
    file: c.file,
    type: c.type,
    subType: c.subType,
    impacted: c.impactedEndpoints.slice(0,3).join(', ') + (c.impactedEndpoints.length > 3 ? ' ...' : ''),
  })));

  const profiles = buildTestProfiles(classified, opts.rootDir);
  
  for (const p of profiles) {
    console.log(`\n--- ${p.change.file} [${p.change.type}/${p.change.subType}] ---`);
    console.log(`  Impacted endpoints: ${p.change.impactedEndpoints.join(', ') || 'none'}`);
    console.log(`  Test Cases: ${p.testCases.map(t => `${t.method} ${t.endpoint} ${t.tag}`).join(' | ')}`);
    
    const links = generateBrowserLinks(p, opts.rootDir, apiUrl);
    console.log(`  Swagger: ${links.swagger}`);
    console.log(`  Direct: ${links.directApi.slice(0,2).join(', ')}`);
    if (opts.verbose) {
      console.log(`  Curl:\n${generateSwaggerCurl(p, opts.rootDir, apiUrl)}`);
    }
    
    if (opts.generateProfiles) {
      const out = generatePlaywrightTestFile(p, `${opts.rootDir}/e2e/auto`, opts.rootDir, apiUrl);
      console.log(`  Generated: ${out}`);
    }
  }

  const graph = await findAffectedTests(diff.files, opts.rootDir);
  const tags = [...new Set(graph.affected.flatMap((t: any) => t.tags as string[]))].filter(t => t !== '@all');
  const command = tags.length === 0 ? 'npx playwright test' : `npx playwright test --grep "${tags.join('|')}"`;

  let testResult: TestResult | undefined;
  if (!opts.dry) {
    testResult = await runTests(command, { verbose: opts.verbose });
  }

  return { classified, profiles, command, testResult, apiUrl, port };
}

export { collectDiff } from './collectors/gitCollector';