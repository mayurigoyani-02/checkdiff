// src/analyzer/graphBuilder.ts - clean matching
import fs from 'fs';
import path from 'path';
import { discoverAllTags, extractKeywordsFromChangedFile } from './testParser';

export async function findAffectedTests(changedFiles: string[], rootDir: string) {
  const { allTags, tests } = discoverAllTags(rootDir);
  
  console.log(`  Discovered ${tests.length} test files with tags: ${[...allTags].join(', ') || 'none - add @tags to your tests!'}`);

  if (tests.length === 0) {
    return { affected: [], allTags, tests, reason: 'No tagged e2e tests found - add @payment @auth etc to your test titles' };
  }

  const changedKeywords = new Set<string>();
  
  for (const file of changedFiles) {
    try {
      const fullPath = path.isAbsolute(file) ? file : path.join(rootDir, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      extractKeywordsFromChangedFile(content).forEach(k => changedKeywords.add(k));
      
      // Also use filename: src/payment/service.ts -> payment
      const base = path.basename(file, path.extname(file)).toLowerCase();
      if (base.length >= 3) changedKeywords.add(base);
    } catch {}
  }

  console.log(`  Changed keywords: ${[...changedKeywords].join(', ') || 'none'}`);

  if (changedKeywords.size === 0) {
    return { affected: [], allTags, tests, reason: `No keywords from changed files: ${changedFiles.join(', ')}`, changedKeywords: [] };
  }

  // Match: changed keyword "payment" matches test tag "@payment"
  const affected: typeof tests = [];
  for (const test of tests) {
    for (const kw of changedKeywords) {
      if (test.tags.includes(`@${kw}`)) {
        affected.push(test);
        break;
      }
    }
  }

  // If no match but core files changed -> @critical
  if (affected.length === 0) {
    const criticalTests = tests.filter(t => t.tags.includes('@critical'));
    const hasCritical = criticalTests.length > 0;
    return { 
      affected: hasCritical ? criticalTests : [],
      allTags, tests, 
      reason: hasCritical 
        ? `Keywords ${[...changedKeywords].join(',')} -> no direct match, fallback to @critical`
        : `Keywords ${[...changedKeywords].join(',')} -> no matching tags, no tests to run`,
      changedKeywords: [...changedKeywords]
    };
  }

  return { 
    affected, allTags, tests, 
    reason: `Changed ${[...changedKeywords].join(', ')} -> matched ${affected.length} test files`,
    changedKeywords: [...changedKeywords]
  };
}

export async function buildGraph(rootDir: string) {
  return { fileToImports: new Map(), importToFiles: new Map() };
}