// src/mapper/impactMapper.ts - FIXED 3 ARGS VERSION
import type { DiffResult } from '../collectors/gitCollector.js';

type AnyDiff = DiffResult | { mode: 'black-box'; url: string; files: string[]; raw?: string };

interface MappingConfig {
  [glob: string]: string[];
}

interface ImpactResult {
  tags: string[];
  files: string[];
  reason: string;
  command?: string;
  stack?: any;
}

export function mapImpact(diff: AnyDiff, mapping: MappingConfig, stack?: any): ImpactResult {
  
  // Black-box mode - no git
  if ((diff as any).mode === 'black-box') {
    const blackBoxDiff = diff as { mode: 'black-box'; url: string };
    return { 
      tags: ['@blackbox'], 
      files: [], 
      reason: `Black-box crawl of ${blackBoxDiff.url}`,
      command: 'npx playwright test --grep @blackbox',
      stack
    };
  }

  // Git mode
  const files = (diff as DiffResult).files || [];

  // If 0 files, fallback to critical
  if (files.length === 0) {
    return {
      tags: ['@critical'],
      files: [],
      reason: 'No changed files mapped - fallback to critical tests',
      command: 'npx playwright test --grep @critical',
      stack
    };
  }

  // Simple mapping
  const tagsSet = new Set<string>();
  
  for (const file of files) {
    let matched = false;
    for (const [pattern, tags] of Object.entries(mapping)) {
      const cleanPattern = pattern.replace('**', '').replace('*', '');
      if (file.includes(cleanPattern) || file.match(pattern.replace(/\*/g, '.*'))) {
        tags.forEach(t => tagsSet.add(t));
        matched = true;
      }
    }
    if (!matched) {
      tagsSet.add('@all');
    }
  }

  const tags = Array.from(tagsSet);
  
  let command = '';
  if (tags.includes('@all') || tags.length === 0) {
    command = 'npx playwright test';
  } else {
    const grepPattern = tags.join('|');
    command = `npx playwright test --grep "${grepPattern}"`;
  }

  return {
    tags,
    files,
    reason: `Mapped ${files.length} files to ${tags.join(', ')}`,
    command,
    stack
  };
}