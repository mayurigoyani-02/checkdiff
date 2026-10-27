import { execSync } from 'child_process';
import { ClassifiedChange } from '../analyzer/changeClassifier';
import { TestProfile } from '../profile/testProfileBuilder';
import { buildContextAwareProfiles, findContextGaps } from './contextTestBuilder';
import { ContextAwareTestCase, ContextGap, EnrichedContext } from './types';
import { fetchEnrichedContext, parseWorkItemRefs } from './workItemProviders';

export interface ContextLearnOptions {
  rootDir: string;
  workItemRaw?: string;
  branchName?: string;
  classified: ClassifiedChange[];
  diffContent?: string;
  repo?: string;
  prLinkedIssueNumbers?: number[];
  prContext?: { title: string; body: string; url?: string };
}

export interface ContextLearnResult {
  enriched: EnrichedContext;
  contextProfiles: TestProfile[];
  contextCases: ContextAwareTestCase[];
  gaps: ContextGap[];
}

function currentBranch(rootDir: string, fallback = ''): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

export async function learnContextAndBuildProfiles(opts: ContextLearnOptions): Promise<ContextLearnResult> {
  const branch = opts.branchName || currentBranch(opts.rootDir);
  const enriched = await fetchEnrichedContext(parseWorkItemRefs(opts.workItemRaw), branch, {
    repo: opts.repo,
    prLinkedIssueNumbers: opts.prLinkedIssueNumbers,
    prContext: opts.prContext,
  });

  const { profiles, contextCases } = buildContextAwareProfiles(opts.classified, enriched);
  const gaps = findContextGaps(opts.classified, enriched, contextCases);

  if (enriched.workItems.length > 0) {
    console.log(`  🧠 Context: ${enriched.workItems.length} work item(s): ${enriched.workItems.map(w => `${w.source}:${w.id} "${w.title.slice(0, 50)}"`).join(', ')}`);
  } else {
    console.log('  🧠 Context: no work item linked — using PR diff + work-item link only');
  }
  if (gaps.length > 0) {
    console.log(`  ⚠ Gaps found: ${gaps.length}`);
    for (const g of gaps.slice(0, 10)) console.log(`    [${g.severity}] ${g.message}`);
  }

  return { enriched, contextProfiles: profiles, contextCases, gaps };
}
