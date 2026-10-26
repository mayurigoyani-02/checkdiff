import fs from 'fs';
import path from 'path';
import { EnrichedContext, ProductFact, ProductKnowledge, WorkItemContext } from './types';

const DEFAULT_KNOWLEDGE: ProductKnowledge = {
  version: 1,
  updatedAt: new Date().toISOString(),
  facts: [],
  workItemsSeen: [],
  totalRuns: 0,
};

export function knowledgePath(rootDir: string): string {
  return path.join(rootDir, '.checkdiff', 'product-knowledge.json');
}

export function loadKnowledge(rootDir: string): ProductKnowledge {
  try {
    const p = knowledgePath(rootDir);
    if (!fs.existsSync(p)) return { ...DEFAULT_KNOWLEDGE };
    return { ...DEFAULT_KNOWLEDGE, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch {
    return { ...DEFAULT_KNOWLEDGE };
  }
}

export function saveKnowledge(rootDir: string, knowledge: ProductKnowledge): void {
  const p = knowledgePath(rootDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  knowledge.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(knowledge, null, 2));
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || [];
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'should', 'when', 'then', 'user', 'will', 'are', 'was', 'has', 'have', 'into', 'add', 'new', 'fix', 'update', 'feature']);
  return [...new Set(words.filter(w => !stop.has(w) && w.length >= 3))].slice(0, 30);
}

function splitCriteria(text: string): string[] {
  return text
    .split(/\r?\n|;(?=\s*[A-Z*•-])/)
    .map(s => s.replace(/^[\s*•\-\d.)\]]+/, '').trim())
    .filter(s => s.length > 3);
}

export function learnFromContext(rootDir: string, enriched: EnrichedContext, endpoints: string[], tags: string[]): ProductKnowledge {
  const knowledge = loadKnowledge(rootDir);
  knowledge.totalRuns += 1;

  for (const wi of enriched.workItems) {
    const ref = `${wi.source}:${wi.id}`;
    if (!knowledge.workItemsSeen.includes(ref)) knowledge.workItemsSeen.push(ref);

    const area = wi.area || 'general';
    let fact = knowledge.facts.find(f => f.area === area);
    if (!fact) {
      fact = { area, keywords: [], endpoints: [], testTags: [], acceptancePatterns: [], seenCount: 0, lastSeen: new Date().toISOString() };
      knowledge.facts.push(fact);
    }
    fact.seenCount += 1;
    fact.lastSeen = new Date().toISOString();

    const kws = [...extractKeywords(`${wi.title} ${wi.description}`), ...enriched.keywords];
    fact.keywords = [...new Set([...fact.keywords, ...kws])].slice(0, 60);
    fact.endpoints = [...new Set([...fact.endpoints, ...endpoints])].slice(0, 100);
    fact.testTags = [...new Set([...fact.testTags, ...tags])].slice(0, 40);
    for (const c of wi.acceptanceCriteria) {
      const first = c.split(/\s+/).slice(0, 5).join(' ');
      if (first && !fact.acceptancePatterns.includes(first)) fact.acceptancePatterns.push(first);
    }
    fact.acceptancePatterns = fact.acceptancePatterns.slice(0, 40);
  }

  if (enriched.workItems.length === 0) {
    let fact = knowledge.facts.find(f => f.area === 'general');
    if (!fact) {
      fact = { area: 'general', keywords: [], endpoints: [], testTags: [], acceptancePatterns: [], seenCount: 0, lastSeen: new Date().toISOString() };
      knowledge.facts.push(fact);
    }
    fact.seenCount += 1;
    fact.lastSeen = new Date().toISOString();
    fact.keywords = [...new Set([...fact.keywords, ...enriched.keywords])].slice(0, 60);
    fact.endpoints = [...new Set([...fact.endpoints, ...endpoints])].slice(0, 100);
    fact.testTags = [...new Set([...fact.testTags, ...tags])].slice(0, 40);
  }

  saveKnowledge(rootDir, knowledge);
  return knowledge;
}

export function matchLearnedFacts(knowledge: ProductKnowledge, enriched: EnrichedContext): ProductFact[] {
  const kwSet = new Set(enriched.keywords.map(k => k.toLowerCase()));
  return knowledge.facts
    .filter(f => f.keywords.some(k => kwSet.has(k.toLowerCase())) || enriched.areas.includes(f.area))
    .slice(0, 10);
}

export function splitAcceptance(text: string): string[] {
  return splitCriteria(text);
}
