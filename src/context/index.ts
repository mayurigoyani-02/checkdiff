import { execSync } from 'child_process';
import { ClassifiedChange } from '../analyzer/changeClassifier';
import { TestProfile } from '../profile/testProfileBuilder';
import { buildContextAwareProfiles, findContextGaps } from './contextTestBuilder';
import { learnFromContext, loadKnowledge, matchLearnedFacts } from './knowledgeStore';
import { ContextAwareTestCase, ContextGap, EnrichedContext, ProductKnowledge } from './types';
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
  knowledge: ProductKnowledge;
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

  const prior = loadKnowledge(opts.rootDir);
  enriched.learnedFacts = matchLearnedFacts(prior, enriched);

  const allEndpoints = [...new Set(opts.classified.flatMap(c => [...c.endpoints, ...c.impactedEndpoints]))];
  const allTags = [...new Set(allEndpoints.map(e => {
    const r = e.toLowerCase();
    if (r.includes('payment')) return '@payment';
    if (r.includes('auth') || r.includes('login')) return '@auth';
    if (r.includes('health')) return '@health';
    return '@api';
  }))];

  const knowledge = learnFromContext(opts.rootDir, enriched, allEndpoints, allTags);

  const { profiles, contextCases } = buildContextAwareProfiles(opts.classified, enriched, enriched.learnedFacts);
  const gaps = findContextGaps(opts.classified, enriched, contextCases);

  if (enriched.workItems.length > 0) {
    console.log(`  🧠 Context: ${enriched.workItems.length} work item(s): ${enriched.workItems.map(w => `${w.source}:${w.id} "${w.title.slice(0, 50)}"`).join(', ')}`);
  } else {
    console.log('  🧠 Context: no work item linked — using diff + learned product knowledge');
  }
  if (enriched.learnedFacts.length > 0) {
    console.log(`  📚 Recalled ${enriched.learnedFacts.length} learned area(s): ${enriched.learnedFacts.map(f => `${f.area} (seen ${f.seenCount}x)`).join(', ')}`);
  }
  console.log(`  📖 Knowledge: ${knowledge.facts.length} area(s), ${knowledge.workItemsSeen.length} work item(s), ${knowledge.totalRuns} run(s)`);
  if (gaps.length > 0) {
    console.log(`  ⚠ Gaps found: ${gaps.length}`);
    for (const g of gaps.slice(0, 10)) console.log(`    [${g.severity}] ${g.message}`);
  }

  return { enriched, knowledge, contextProfiles: profiles, contextCases, gaps };
}
