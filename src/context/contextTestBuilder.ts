import { ClassifiedChange } from '../analyzer/changeClassifier';
import { TestProfile } from '../profile/testProfileBuilder';
import { ContextAwareTestCase, ContextGap, EnrichedContext } from './types';

function methodFor(route: string, change: ClassifiedChange): string {
  const hit = change.endpoints.find(e => e.endsWith(route));
  return hit ? hit.split(' ')[0] : 'GET';
}

function payloadFor(route: string, method: string): any {
  const r = route.toLowerCase();
  if (method === 'POST' && r.includes('payment')) return { amount: 100, currency: 'USD', paymentMethod: 'card', userId: 'test-123' };
  if (method === 'POST' && (r.includes('auth') || r.includes('login'))) return { email: 'test@example.com', password: 'Test@123' };
  if (method === 'POST' && r.includes('api')) return { name: 'test', value: 'test-data' };
  return undefined;
}

function tagFor(route: string, area: string): string {
  const r = `${route} ${area}`.toLowerCase();
  if (r.includes('payment')) return '@payment';
  if (r.includes('auth') || r.includes('login')) return '@auth';
  if (r.includes('checkout') || r.includes('cart') || r.includes('order')) return '@checkout';
  if (r.includes('health')) return '@health';
  return '@api';
}

export function buildContextAwareProfiles(
  classified: ClassifiedChange[],
  enriched: EnrichedContext,
): { profiles: TestProfile[]; contextCases: ContextAwareTestCase[] } {
  const profiles: TestProfile[] = [];
  const contextCases: ContextAwareTestCase[] = [];

  for (const change of classified) {
    const area = enriched.areas[0] || 'general';
    const eps = change.impactedEndpoints.length ? change.impactedEndpoints : change.endpoints;
    const testCases: TestProfile['testCases'] = [];
    const testData: Record<string, any> = {};

    for (const epStr of eps) {
      const parts = epStr.split(' ');
      const route = parts[1] || parts[0] || '/api/health';
      const method = parts[0]?.match(/GET|POST|PUT|PATCH|DELETE/i) ? parts[0].toUpperCase() : methodFor(route, change);
      const criteria = enriched.acceptanceCriteria.filter(c => {
        const words = c.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        return words.some(w => route.toLowerCase().includes(w) || change.file.toLowerCase().includes(w));
      });
      const wi = enriched.workItems[0];
      const tag = tagFor(route, area);
      const payload = payloadFor(route, method);
      if (payload) testData[tag.replace('@', '')] = payload;

      testCases.push({
        title: wi ? `[${wi.source}:${wi.id}] Verify ${method} ${route} — ${wi.title.slice(0, 60)}` : `Verify ${method} ${route} after ${change.subType} (${area})`,
        tag,
        endpoint: route,
        method,
        payload,
        expectedStatus: 200,
      });
      contextCases.push({
        title: `Verify ${method} ${route}`,
        tag,
        endpoint: route,
        method,
        payload,
        expectedStatus: 200,
        linkedCriteria: criteria,
        workItemId: wi ? `${wi.source}:${wi.id}` : undefined,
        confidence: 0.85,
      });
    }

    if (testCases.length === 0) {
      testCases.push({
        title: `Smoke: ${change.file} (${area}) — health check`,
        tag: '@critical',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
      });
    }

    profiles.push({ change, gitHistory: [], testCases, testData });
  }

  for (const c of enriched.acceptanceCriteria) {
    const words = c.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const covered = contextCases.some(tc =>
      words.some(w => tc.endpoint.toLowerCase().includes(w) || tc.title.toLowerCase().includes(w)));
    if (!covered) {
      contextCases.push({
        title: `Acceptance: ${c.slice(0, 80)}`,
        tag: '@acceptance',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        linkedCriteria: [c],
        workItemId: enriched.workItems[0] ? `${enriched.workItems[0].source}:${enriched.workItems[0].id}` : undefined,
        confidence: 0.4,
      });
    }
  }

  return { profiles, contextCases };
}

export function findContextGaps(
  classified: ClassifiedChange[],
  enriched: EnrichedContext,
  contextCases: ContextAwareTestCase[],
): ContextGap[] {
  const gaps: ContextGap[] = [];

  if (enriched.workItems.length === 0) {
    gaps.push({
      severity: 'medium',
      category: 'no-workitem-link',
      message: 'No work item linked — add --workItem "https://github.com/owner/repo/issues/123" (or "#123", ADO URL, or Jira PROJ-123) or link via PR body "Fixes #123".',
      suggestion: 'Pass one work-item link; for private repos set GITHUB_TOKEN. CI gate (--requireWorkItem) fails if still unlinked.',
    });
  }

  const uncovered = enriched.acceptanceCriteria.filter(c => {
    const words = c.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    return !contextCases.some(tc =>
      tc.linkedCriteria.includes(c) ||
      (tc.endpoint !== '/api/health' && words.some(w => tc.endpoint.toLowerCase().includes(w))));
  });
  for (const c of uncovered.slice(0, 10)) {
    gaps.push({
      severity: 'high',
      category: 'missing-acceptance-test',
      message: `Acceptance criterion has no dedicated test: "${c.slice(0, 120)}"`,
      suggestion: 'Add an endpoint or e2e test tagged to this criterion, or extend the context-aware profile.',
    });
  }

  for (const area of enriched.areas) {
    if (area === 'general') continue;
    const covered = contextCases.some(tc => tc.endpoint !== '/api/health') || classified.length > 0;
    if (!covered) {
      gaps.push({
        severity: 'medium',
        category: 'untested-area',
        message: `Work-item area "${area}" has no exercised endpoint in changed files.`,
        suggestion: `Check whether the change should touch ${area} routes, or the work-item area mapping is wrong.`,
      });
    }
  }

  const changedRoutes = new Set(classified.flatMap(c => [...c.routes, ...c.impactedEndpoints.map(e => e.split(' ')[1] || e)]));
  for (const r of [...changedRoutes].slice(0, 20)) {
    if (!contextCases.some(tc => tc.endpoint === r)) {
      gaps.push({
        severity: 'low',
        category: 'untested-endpoint',
        message: `Changed route "${r}" produced no test case.`,
        suggestion: 'Verify the route is still reachable or add it to the profile generator.',
      });
    }
  }

  return gaps;
}
