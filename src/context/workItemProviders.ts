import { EnrichedContext, WorkItemContext } from './types';
import { parseWorkItemLinks, workItemRefsToLegacyRequest } from '../utils/links';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function parseRepoFromRemote(): string | undefined {
  try {
    const { execSync } = require('child_process');
    const url: string = (execSync('git remote get-url origin 2>&1', { encoding: 'utf8' }) as string).trim();
    if (!url) return undefined;
    let m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1].replace(/\.git$/, '');
    m = url.match(/([^/:]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1].replace(/\.git$/, '');
    return undefined;
  } catch { return undefined; }
}

function resolveGitHubRepo(explicit?: string): string | undefined {
  return explicit || env('GITHUB_REPOSITORY') || env('GH_REPO') || parseRepoFromRemote();
}

function githubHeaders(): Record<string, string> {
  const token = env('GITHUB_TOKEN') || env('GH_TOKEN') || env('GITHUB_PAT') || env('GH_PAT');
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function splitCriteria(text: string): string[] {
  return text
    .split(/\r?\n|;(?=\s*[A-Z*•-])/)
    .map(s => s.replace(/^[\s*•\-\d.)\]]+/, '').trim())
    .filter(s => s.length > 3);
}

function extractAcceptanceFromBody(body: string): string[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const criteria: string[] = [];
  let inAcceptance = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^#{0,3}\s*(acceptance criteria|acceptance|ac:|criteria)/i.test(line) || lower.includes('acceptance criteria')) {
      inAcceptance = true;
      const after = line.replace(/^#{0,3}\s*(acceptance criteria|acceptance|ac:|criteria)\s*:?\s*/i, '').trim();
      if (after) criteria.push(...splitCriteria(after));
      continue;
    }
    if (inAcceptance) {
      if (/^#{1,6}\s+/.test(line) && !/acceptance/i.test(line)) { inAcceptance = false; continue; }
      if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]') || /^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        criteria.push(line.replace(/^\s*[-*•\d.)\]]+\s*|\[.\]\s*/g, '').trim());
      } else if (line.trim() === '') {
        continue;
      } else if (line.trim().startsWith('-')) {
        criteria.push(line.replace(/^\s*-\s*/, '').trim());
      }
    }
  }
  // Also split markdown task lists globally if no section found
  if (criteria.length === 0) {
    const taskItems = [...body.matchAll(/- \[[ x]\]\s+(.+)/gi)].map(m => m[1].trim()).filter(Boolean);
    if (taskItems.length) criteria.push(...taskItems);
  }
  // If body has numbered/bulleted list under any heading, grab plausible lines
  return [...new Set(criteria.filter(c => c.length > 3))].slice(0, 20);
}

function parseGitHubIssueRefs(raw?: string): { numbers: number[]; urls: string[] } {
  const numbers: number[] = [];
  const urls: string[] = [];
  if (!raw) return { numbers, urls };
  for (const part of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const urlMatch = part.match(/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)/i);
    if (urlMatch) {
      urls.push(part);
      numbers.push(parseInt(urlMatch[2], 10));
      continue;
    }
    if (/^#?\d+$/.test(part)) {
      numbers.push(parseInt(part.replace(/^#/, ''), 10));
      continue;
    }
    if (/^https?:\/\//i.test(part)) {
      urls.push(part);
    }
  }
  return { numbers, urls };
}

async function fetchGitHubIssues(repo: string, numbers: number[]): Promise<WorkItemContext[]> {
  const headers = githubHeaders();
  const items: WorkItemContext[] = [];
  for (const num of numbers) {
    const data: any = await fetchJson(`https://api.github.com/repos/${repo}/issues/${num}`, headers);
    const body: string = data.body || '';
    const acceptance = extractAcceptanceFromBody(body);
    // Append checklist items from comments as additional signal (best-effort)
    let commentText = '';
    try {
      const comments: any[] = await fetchJson(`https://api.github.com/repos/${repo}/issues/${num}/comments?per_page=50`, headers);
      commentText = comments.map(c => c.body || '').join('\n').slice(0, 2000);
    } catch {}
    const fullBody = [body, commentText].filter(Boolean).join('\n\n');
    const labels: string[] = (data.labels || []).map((l: any) => typeof l === 'string' ? l : l.name).filter(Boolean);
    items.push({
      id: String(data.number),
      source: 'github',
      title: data.title || `GitHub #${num}`,
      description: fullBody.slice(0, 4000),
      acceptanceCriteria: acceptance,
      area: labels.find(l => /^(payment|checkout|auth|cart|order|product|admin|billing|area)/i.test(l)) || labels[0] || '',
      tags: labels,
      state: data.state || '',
      url: data.html_url || `https://github.com/${repo}/issues/${num}`,
    });
  }
  return items;
}

function adoAuth(): Record<string, string> {
  const pat = env('ADO_PAT');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (pat) headers['Authorization'] = `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
  return headers;
}

async function fetchAdo(ids: string[]): Promise<WorkItemContext[]> {
  const org = env('ADO_ORG');
  const project = env('ADO_PROJECT');
  const base = (env('ADO_BASE_URL') || (org ? `https://dev.azure.com/${org}` : undefined))?.replace(/\/$/, '');
  if (!base) throw new Error('ADO org missing: set ADO_ORG or ADO_BASE_URL');
  const items: WorkItemContext[] = [];
  for (const id of ids) {
    const url = project
      ? `${base}/${encodeURIComponent(project)}/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=all&api-version=7.0`
      : `${base}/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=all&api-version=7.0`;
    const data = await fetchJson(url, adoAuth());
    const f = data.fields || {};
    const desc: string = (f['System.Description'] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const criteriaRaw: string = (f['Microsoft.VSTS.Common.AcceptanceCriteria'] || '').replace(/<[^>]+>/g, '\n').trim();
    items.push({
      id: String(data.id ?? id),
      source: 'ado',
      title: f['System.Title'] || `ADO-${id}`,
      description: desc,
      acceptanceCriteria: criteriaRaw ? criteriaRaw.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean) : [],
      area: f['System.AreaPath'] || '',
      tags: (f['System.Tags'] || '').split(';').map((s: string) => s.trim()).filter(Boolean),
      state: f['System.State'] || '',
      url: (data._links?.html?.href as string) || undefined,
    });
  }
  return items;
}

function jiraAuth(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const email = env('JIRA_EMAIL');
  const token = env('JIRA_API_TOKEN');
  if (email && token) headers['Authorization'] = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  else if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function adfToText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('\n');
  if (node.text) return node.text;
  if (node.content) return adfToText(node.content);
  return '';
}

async function fetchJira(ids: string[]): Promise<WorkItemContext[]> {
  const base = env('JIRA_BASE_URL')?.replace(/\/$/, '');
  if (!base) throw new Error('Jira base missing: set JIRA_BASE_URL');
  const items: WorkItemContext[] = [];
  for (const id of ids) {
    const data = await fetchJson(`${base}/rest/api/3/issue/${encodeURIComponent(id)}`, jiraAuth());
    const f = data.fields || {};
    items.push({
      id: data.key || id,
      source: 'jira',
      title: f.summary || id,
      description: typeof f.description === 'string' ? f.description : adfToText(f.description),
      acceptanceCriteria: [],
      area: f.project?.key || '',
      tags: (f.labels || []) as string[],
      state: f.status?.name || '',
      url: `${base}/browse/${encodeURIComponent(data.key || id)}`,
    });
  }
  return items;
}

export interface WorkItemRequest {
  adoIds: string[];
  jiraKeys: string[];
  githubIssueNumbers: number[];
  manualText: string[];
  repoHint?: string;
}

// Back-compat wrapper: delegates to utils/links so PR + workitem parsing is unified
export function parseWorkItemRefs(raw?: string): WorkItemRequest {
  return workItemRefsToLegacyRequest(parseWorkItemLinks(raw));
}

function inferArea(text: string): string {
  const m = text.toLowerCase().match(/(payment|checkout|auth|login|cart|order|search|profile|admin|billing|notification|report|dashboard)/);
  return m ? m[1] : 'general';
}

export async function fetchEnrichedContext(req: WorkItemRequest, branchName = '', opts?: { repo?: string; prLinkedIssueNumbers?: number[]; prContext?: { title: string; body: string; url?: string } }): Promise<EnrichedContext> {
  const workItems: WorkItemContext[] = [];

  // GitHub: explicit issue numbers (including those parsed from URLs)
  const repo = resolveGitHubRepo(opts?.repo || req.repoHint);
  const githubNumbers = [...new Set([...(req.githubIssueNumbers || []), ...(opts?.prLinkedIssueNumbers || [])])];

  // If numeric refs may be GitHub issues and ADO is not configured, try GitHub
  const adoConfigured = !!(env('ADO_ORG') || env('ADO_BASE_URL'));
  const numericAsGitHub = !adoConfigured && repo && req.adoIds.length > 0 && req.jiraKeys.length === 0;

  if (githubNumbers.length && repo) {
    try {
      const items = await fetchGitHubIssues(repo, githubNumbers);
      workItems.push(...items);
      // Remove those numbers from adoIds so we don't double-try them as ADO
      const consumed = new Set(githubNumbers.map(String));
      req.adoIds = req.adoIds.filter(id => !consumed.has(id));
    } catch (e: any) {
      console.log(`  ⚠ GitHub fetch failed: ${e.message} (set GITHUB_TOKEN for private repos)`);
    }
  }

  // Also try to resolve numeric refs as GitHub issues if ADO not configured
  if (numericAsGitHub && req.adoIds.length) {
    const nums = req.adoIds.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    if (nums.length && repo) {
      try {
        const items = await fetchGitHubIssues(repo, nums);
        workItems.push(...items);
        req.adoIds = [];
      } catch (e: any) {
        console.log(`  ⚠ GitHub issue fetch for ${nums.join(',')} failed: ${e.message}`);
      }
    }
  }

  if (req.adoIds.length) {
    try {
      workItems.push(...await fetchAdo(req.adoIds));
    } catch (e: any) {
      console.log(`  ⚠ ADO fetch failed: ${e.message} (set ADO_ORG/ADO_PROJECT/ADO_PAT)`);
      // If ADO failed and we have a repo, retry those same ids as GitHub issues
      if (repo && !githubNumbers.length) {
        const nums = req.adoIds.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
        if (nums.length) {
          try {
            const items = await fetchGitHubIssues(repo, nums);
            workItems.push(...items);
          } catch {}
        }
      }
    }
  }
  if (req.jiraKeys.length) {
    try {
      workItems.push(...await fetchJira(req.jiraKeys));
    } catch (e: any) {
      console.log(`  ⚠ Jira fetch failed: ${e.message} (set JIRA_BASE_URL/JIRA_EMAIL/JIRA_API_TOKEN)`);
    }
  }

  // PR-derived context as fallback signal even if no issue was linked
  if (workItems.length === 0 && opts?.prContext && (opts.prContext.title || opts.prContext.body)) {
    const title = opts.prContext.title || '';
    const body = opts.prContext.body || '';
    const criteria = extractAcceptanceFromBody(body);
    if (title || body) {
      workItems.push({
        id: `pr:${title.slice(0, 30) || 'context'}`,
        source: 'manual',
        title: title || 'PR context',
        description: body.slice(0, 3000),
        acceptanceCriteria: criteria,
        area: inferArea(`${title} ${body}`),
        tags: [],
        state: '',
        url: opts.prContext.url,
      });
    }
  }

  for (const t of req.manualText) {
    workItems.push({ id: t, source: 'manual', title: t, description: t, acceptanceCriteria: [], area: inferArea(t), tags: [], state: '' });
  }

  const branchIds = [...branchName.matchAll(/(?:AB#?(\d+))|(?:([A-Z][A-Z0-9]+-\d+))/gi)].flatMap(m => [m[1], m[2]].filter(Boolean) as string[]);
  if (workItems.length === 0 && branchIds.length > 0) {
    return fetchEnrichedContext(parseWorkItemRefs(branchIds.join(',')), '', opts);
  }

  // GitHub branch convention: 123-short-desc, feat/#123, issue-123
  const ghBranchNums = [...branchName.matchAll(/(?:^|[\/#-])(\d+)(?:[-_]|$)/g)].map(m => parseInt(m[1], 10)).filter(n => n > 0 && n < 1000000);
  if (workItems.length === 0 && ghBranchNums.length > 0 && repo) {
    const candidate = ghBranchNums[0];
    try {
      const items = await fetchGitHubIssues(repo, [candidate]);
      if (items.length) workItems.push(...items);
    } catch {}
  }

  const blob = workItems.map(w => `${w.title} ${w.description} ${w.acceptanceCriteria.join(' ')} ${w.area} ${w.tags.join(' ')}`).join(' ').toLowerCase();
  const keywords = [...new Set((blob.match(/[a-z][a-z0-9-]{2,}/g) || []).filter(w => w.length >= 3))].slice(0, 40);

  return {
    workItems,
    keywords,
    areas: [...new Set(workItems.map(w => w.area || inferArea(`${w.title} ${w.description}`)))],
    acceptanceCriteria: [...new Set(workItems.flatMap(w => w.acceptanceCriteria))],
  };
}
