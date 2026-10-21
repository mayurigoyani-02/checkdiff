// src/mapper/impactMapper.ts - NEVER grep @all
import { findAffectedTests } from '../analyzer/graphBuilder';
import { aiImpact } from '../ai/impactAnalyzer';

export interface ImpactResult {
  tags: string[];
  files: string[];
  reason: string;
  command: string;
  affectedTests?: string[];
}

export async function mapImpact(diff: any, opts: { rootDir: string; ai?: boolean; verbose?: boolean }): Promise<ImpactResult> {
  let files = (diff.files || []).filter((f: string) => 
    !/package-lock|yarn\.lock|README|\.last-run|test-results|node_modules|\.git/.test(f)
  );

  if (files.length === 0) {
    return { tags: [], files: [], reason: 'Only ignored files', command: 'echo "No tests needed"' };
  }

  const graphResult = await findAffectedTests(files, opts.rootDir);
  
  let tags: string[] = [...new Set(graphResult.affected.flatMap((t: any) => t.tags as string[]))];

  // FIX 1: Remove @all from tags - @all means run everything, not grep @all
  const hasAll = tags.includes('@all');
  tags = tags.filter(t => t !== '@all');

  // Layer 2: AI refinement
  if (opts.ai) {
    const aiResult = await aiImpact(files, diff.diffContent || '', opts.rootDir);
    if (aiResult.tags.length > 0) {
      const aiHasAll = aiResult.tags.includes('@all');
      tags = aiResult.tags.filter(t => t !== '@all');
      if (aiHasAll) {
        // AI says run all
        return {
          tags: ['@all'],
          files,
          reason: `${graphResult.reason} | AI: ${aiResult.reason} -> ALL tests`,
          command: 'npx playwright test',
          affectedTests: graphResult.affected.map((t: any) => t.path)
        };
      }
      graphResult.reason = `${graphResult.reason} | AI: ${aiResult.reason}`;
    }
  }

  // FIX 2: If graph said @all or no tags found
  if (hasAll || tags.length === 0) {
    if (graphResult.affected.length > 0) {
      // Run only affected test files directly, not grep @all
      const testFiles = graphResult.affected.map((t: any) => t.path).join(' ');
      return {
        tags: tags.length ? tags : ['@critical'],
        files,
        reason: hasAll ? 'Core change detected, running affected files' : graphResult.reason,
        command: testFiles ? `npx playwright test ${testFiles}` : 'npx playwright test --grep "@critical"',
        affectedTests: graphResult.affected.map((t: any) => t.path)
      };
    } else {
      // Truly core change - run all
      return {
        tags: ['@all'],
        files,
        reason: 'Major core change, running all tests',
        command: 'npx playwright test',
        affectedTests: []
      };
    }
  }

  // Normal case: grep with real tags like @payment|@auth
  const command = `npx playwright test --grep "${tags.join('|')}"`;

  return {
    tags,
    files,
    reason: graphResult.reason,
    command,
    affectedTests: graphResult.affected.map((t: any) => t.path)
  };
}