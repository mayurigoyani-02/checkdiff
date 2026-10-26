export type WorkItemSource = 'ado' | 'jira' | 'github' | 'manual';

export interface WorkItemContext {
  id: string;
  source: WorkItemSource;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  area: string;
  tags: string[];
  state: string;
  url?: string;
}

export interface ProductFact {
  area: string;
  keywords: string[];
  endpoints: string[];
  testTags: string[];
  acceptancePatterns: string[];
  seenCount: number;
  lastSeen: string;
}

export interface ProductKnowledge {
  version: 1;
  updatedAt: string;
  facts: ProductFact[];
  workItemsSeen: string[];
  totalRuns: number;
}

export interface EnrichedContext {
  workItems: WorkItemContext[];
  keywords: string[];
  areas: string[];
  acceptanceCriteria: string[];
  learnedFacts: ProductFact[];
}

export interface ContextGap {
  severity: 'high' | 'medium' | 'low';
  category: 'missing-acceptance-test' | 'untested-area' | 'untested-endpoint' | 'no-workitem-link' | 'stale-knowledge';
  message: string;
  suggestion: string;
}

export interface ContextAwareTestCase {
  title: string;
  tag: string;
  endpoint: string;
  method: string;
  payload?: any;
  expectedStatus: number;
  linkedCriteria: string[];
  workItemId?: string;
  confidence: number;
}
