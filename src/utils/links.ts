// Shared link parsing: PR link and work-item link → typed refs.
// Called by CLI, collector, workItemProviders, and CI.

export type WorkItemSource = 'github' | 'ado' | 'jira' | 'manual';

export interface PrRef {
  raw: string;
  repo?: string;       // owner/repo when derivable from URL
  number?: number;
  url?: string;
  type: 'github-pr';
}

export interface WorkItemRef {
  raw: string;
  source: WorkItemSource;
  // github: number + repo (+ url). ado: id. jira: key. manual: text
  githubNumber?: number;
  githubRepo?: string;
  githubUrl?: string;
  adoId?: string;
  jiraKey?: string;
  manualText?: string;
}

const GITHUB_PR_RE = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i;
const GITHUB_ISSUE_RE = /github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)/i;

export function parsePrLink(raw?: string): PrRef | undefined {
  if (!raw || !String(raw).trim()) return undefined;
  const s = String(raw).trim();
  const urlMatch = s.match(GITHUB_PR_RE);
  if (urlMatch) {
    return { raw: s, repo: urlMatch[1], number: parseInt(urlMatch[2], 10), url: s.startsWith('http') ? s : `https://${s}`, type: 'github-pr' };
  }
  // Also accept "#123" or "123" or "owner/repo#123" for PR number shorthand
  const hashNum = s.match(/^(?:#)?(\d+)$/);
  if (hashNum) return { raw: s, number: parseInt(hashNum[1], 10), type: 'github-pr' };
  const repoHash = s.match(/^([^/]+\/[^/]+)#(\d+)$/);
  if (repoHash) return { raw: s, repo: repoHash[1], number: parseInt(repoHash[2], 10), type: 'github-pr' };
  const plainNum = s.match(/^\d+$/);
  if (plainNum) return { raw: s, number: parseInt(s, 10), type: 'github-pr' };
  return { raw: s, type: 'github-pr' };
}

export function parseWorkItemLinks(raw?: string): WorkItemRef[] {
  if (!raw || !String(raw).trim()) return [];
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  const out: WorkItemRef[] = [];
  for (const p of parts) {
    // GitHub Issue URL: https://github.com/owner/repo/issues/123 (or /pull/123)
    const ghUrlMatch = p.match(GITHUB_ISSUE_RE);
    if (ghUrlMatch) {
      out.push({ raw: p, source: 'github', githubNumber: parseInt(ghUrlMatch[2], 10), githubRepo: ghUrlMatch[1], githubUrl: p.startsWith('http') ? p : `https://${p}` });
      continue;
    }
    // owner/repo#123
    const repoHash = p.match(/^([^/]+\/[^/]+)#(\d+)$/);
    if (repoHash) {
      out.push({ raw: p, source: 'github', githubNumber: parseInt(repoHash[2], 10), githubRepo: repoHash[1] });
      continue;
    }
    // Jira key PROJ-123
    if (/^[A-Z][A-Z0-9]+-\d+$/i.test(p)) {
      out.push({ raw: p, source: 'jira', jiraKey: p.toUpperCase() });
      continue;
    }
    // ADO URL: dev.azure.com/org/project/_workitems/edit/123
    const adoUrlMatch = p.match(/dev\.azure\.com\/[^/]+\/[^/]+\/_workitems\/edit\/(\d+)/i);
    if (adoUrlMatch) {
      out.push({ raw: p, source: 'ado', adoId: adoUrlMatch[1] });
      continue;
    }
    if (/^#\d+$/.test(p)) {
      out.push({ raw: p, source: 'github', githubNumber: parseInt(p.slice(1), 10) });
      continue;
    }
    // Bare numeric: default to GitHub Issue (common in CI); workItemProviders still has ADO fallback
    if (/^\d+$/.test(p)) {
      out.push({ raw: p, source: 'github', githubNumber: parseInt(p, 10) });
      continue;
    }
    // Fallback: manual text
    out.push({ raw: p, source: 'manual', manualText: p });
  }
  return out;
}

export function workItemRefsToLegacyRequest(refs: WorkItemRef[]) {
  const adoIds: string[] = [];
  const jiraKeys: string[] = [];
  const githubNumbers: number[] = [];
  const manualText: string[] = [];
  let repoHint: string | undefined;
  for (const r of refs) {
    if (r.source === 'github' && r.githubNumber) { githubNumbers.push(r.githubNumber); if (r.githubRepo && !repoHint) repoHint = r.githubRepo; }
    else if (r.source === 'ado' && r.adoId) adoIds.push(r.adoId);
    else if (r.source === 'jira' && r.jiraKey) jiraKeys.push(r.jiraKey);
    else if (r.source === 'manual' && r.manualText) manualText.push(r.manualText);
    else if (r.adoId) adoIds.push(r.adoId);
    else if (r.jiraKey) jiraKeys.push(r.jiraKey);
  }
  return { adoIds, jiraKeys, githubIssueNumbers: githubNumbers, manualText, repoHint };
}
