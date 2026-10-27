// Upload the CheckDiff HTML report to linked work items.
// GitHub Issue: comment + upload as gist-like attachment via issue comment.
// ADO: attach via _apis/wit/attachments + link to work item.
// Jira: attach via /rest/api/3/issue/{key}/attachments.

import fs from 'fs';
import path from 'path';
import { WorkItemContext } from '../context/types';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export interface PublishResult {
  workItemRef: string;
  ok: boolean;
  message: string;
  error?: string;
}

const MARKER = '<!-- checkdiff-report -->';
const MARKER_END = '<!-- /checkdiff-report -->';

function reportSummaryHtml(reportPath: string): string {
  try {
    const html = fs.readFileSync(reportPath, 'utf8');
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'CheckDiff Report';
    return title;
  } catch { return 'CheckDiff Report'; }
}

function githubAuthHeaders(): Record<string, string> {
  const token = env('GITHUB_TOKEN') || env('GH_TOKEN') || env('GITHUB_PAT') || env('GH_PAT');
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function inferGitHubRepoFromWorkItem(wi: WorkItemContext, fallbackRepo?: string): string | undefined {
  if (!wi.url) return fallbackRepo;
  const m = wi.url.match(/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)/i);
  if (m) return m[1];
  if (wi.source === 'github' && fallbackRepo) return fallbackRepo;
  return fallbackRepo;
}

async function publishToGitHubIssue(wi: WorkItemContext, reportPath: string, fallbackRepo?: string, pr?: any): Promise<PublishResult> {
  const ref = `${wi.source}:${wi.id}`;
  const repo = inferGitHubRepoFromWorkItem(wi, fallbackRepo) || fallbackRepo || env('GITHUB_REPOSITORY') || '';
  if (!repo) return { workItemRef: ref, ok: false, message: '', error: 'Cannot infer GitHub repo for issue ' + wi.id + ' (set GITHUB_REPOSITORY or use repo in --pr URL)' };
  const issueNumber = wi.id.replace(/^pr:/, '');
  const numeric = parseInt(issueNumber, 10);
  if (isNaN(numeric)) {
    if (pr?.number && repo) {
      const workflowUrl2 = env('GITHUB_SERVER_URL') && env('GITHUB_REPOSITORY') && env('GITHUB_RUN_ID')
        ? `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`
        : '';
      const hint2 = workflowUrl2 ? `Open the run → Artifacts → download \`checkdiff-report\`.\n${workflowUrl2}` : 'Actions tab → run → Artifacts → checkdiff-report.';
      const url = `https://api.github.com/repos/${repo}/issues/${pr.number}/comments`;
      const body = `${MARKER}\n### 🔍 CheckDiff — PR context (no linked Issue)\n${reportSummaryHtml(reportPath)}\n\nPR: ${pr.url || ''}\n\n> Full HTML report is a workflow artifact: ${hint2}\nUse \`--workItem https://github.com/${repo}/issues/<id>\` to attach to a real work item.\n${MARKER_END}`;
      try {
        const res = await fetch(url, { method: 'POST', headers: { ...githubAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
        if (!res.ok) throw new Error(`${res.status} ${await res.text().then(t => t.slice(0, 400)).catch(() => '')}`);
        return { workItemRef: ref, ok: true, message: `Commented on PR #${pr.number} (${repo})` };
      } catch (e: any) { return { workItemRef: ref, ok: false, message: '', error: e.message }; }
    }
    return { workItemRef: ref, ok: false, message: '', error: 'Non-numeric GitHub work item id cannot be published: ' + wi.id };
  }
  const commentsUrl = `https://api.github.com/repos/${repo}/issues/${numeric}/comments?per_page=100`;
  const headers = githubAuthHeaders();
  try {
    try {
      const listRes = await fetch(commentsUrl, { headers });
      if (listRes.ok) {
        const comments: any[] = await listRes.json();
        for (const c of comments.reverse()) {
          if (typeof c.body === 'string' && c.body.includes(MARKER)) {
            await fetch(`https://api.github.com/repos/${repo}/issues/comments/${c.id}`, { method: 'DELETE', headers });
            break;
          }
        }
      }
    } catch {}
    const summary = reportSummaryHtml(reportPath);
    const gapsNote = wi.acceptanceCriteria?.length ? `\nAcceptance: ${wi.acceptanceCriteria.slice(0, 3).join(' | ').slice(0, 300)}` : '';
    const prNote = pr ? `\nPR: ${pr.url || `#${pr.number}`}` : '';
    const workflowUrl = env('GITHUB_SERVER_URL') && env('GITHUB_REPOSITORY') && env('GITHUB_RUN_ID')
      ? `\nWorkflow run (Actions tab → Artifacts → checkdiff-report): ${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`
      : '';
    const artifactHint = workflowUrl
      ? `**How to find it:** open the workflow run above → scroll to **Artifacts** at the bottom → download \`checkdiff-report\` (contains \`checkdiff-report.html\`).`
      : 'Artifact: `checkdiff-report` on this workflow run (Actions tab → run → Artifacts).';
    const body = `${MARKER}\n### 🔍 CheckDiff Report — ${summary}\n${gapsNote}${prNote}\n${workflowUrl}\n${artifactHint}\n\n*Work item:* ${wi.url || `${repo}#${numeric}`} — ${wi.title || ''}\n${MARKER_END}`;
    const postRes = await fetch(`https://api.github.com/repos/${repo}/issues/${numeric}/comments`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
    });
    if (!postRes.ok) throw new Error(`${postRes.status} ${await postRes.text().then(t => t.slice(0, 500)).catch(() => '')}`);
    return { workItemRef: ref, ok: true, message: `Commented on ${repo}#${numeric} (report as workflow artifact)` };
  } catch (e: any) {
    return { workItemRef: ref, ok: false, message: '', error: e.message };
  }
}

async function publishToAdo(wi: WorkItemContext, reportPath: string): Promise<PublishResult> {
  const ref = `ado:${wi.id}`;
  const org = env('ADO_ORG');
  const project = env('ADO_PROJECT');
  const base = (env('ADO_BASE_URL') || (org ? `https://dev.azure.com/${org}` : undefined))?.replace(/\/$/, '');
  const pat = env('ADO_PAT');
  if (!base || !pat) return { workItemRef: ref, ok: false, message: '', error: 'ADO publish needs ADO_ORG (or ADO_BASE_URL) + ADO_PAT' + (project ? '' : ' (ADO_PROJECT optional)') };
  const auth = `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
  try {
    const fileName = path.basename(reportPath);
    const content = fs.readFileSync(reportPath);
    const attachUrl = project
      ? `${base}/${encodeURIComponent(project)}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.0`
      : `${base}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.0`;
    const attachRes = await fetch(attachUrl, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: content as any });
    if (!attachRes.ok) throw new Error(`ADO attach failed: ${attachRes.status} ${await attachRes.text().then(t => t.slice(0, 500)).catch(() => '')}`);
    const attachData: any = await attachRes.json();
    const attachUrl2: string = attachData.url;
    const linkUrl = project
      ? `${base}/${encodeURIComponent(project)}/_apis/wit/workitems/${encodeURIComponent(wi.id)}?api-version=7.0`
      : `${base}/_apis/wit/workitems/${encodeURIComponent(wi.id)}?api-version=7.0`;
    const patchBody = [
      { op: 'add', path: '/relations/-', value: { rel: 'AttachedFile', url: attachUrl2, attributes: { comment: 'CheckDiff HTML report' } } },
      { op: 'add', path: '/fields/System.History', value: `${MARKER} CheckDiff report attached: ${fileName} — ${new Date().toISOString()} ${MARKER_END}` },
    ];
    const patchRes = await fetch(linkUrl, { method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json-patch+json' }, body: JSON.stringify(patchBody) });
    if (!patchRes.ok) throw new Error(`ADO link failed: ${patchRes.status} ${await patchRes.text().then(t => t.slice(0, 500)).catch(() => '')}`);
    return { workItemRef: ref, ok: true, message: `Attached ${fileName} to ADO #${wi.id}` };
  } catch (e: any) { return { workItemRef: ref, ok: false, message: '', error: e.message }; }
}

async function publishToJira(wi: WorkItemContext, reportPath: string): Promise<PublishResult> {
  const ref = `jira:${wi.id}`;
  const base = env('JIRA_BASE_URL')?.replace(/\/$/, '');
  const email = env('JIRA_EMAIL');
  const token = env('JIRA_API_TOKEN');
  if (!base || !token) return { workItemRef: ref, ok: false, message: '', error: 'Jira publish needs JIRA_BASE_URL + JIRA_API_TOKEN (JIRA_EMAIL if basic auth)' };
  const auth = email ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}` : `Bearer ${token}`;
  try {
    const fileName = path.basename(reportPath);
    const content = fs.readFileSync(reportPath);
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/html' }), fileName);
    const url = `${base}/rest/api/3/issue/${encodeURIComponent(wi.id)}/attachments`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'X-Atlassian-Token': 'no-check' } as any, body: form as any });
    if (!res.ok) throw new Error(`Jira attach failed: ${res.status} ${await res.text().then(t => t.slice(0, 500)).catch(() => '')}`);
    try {
      const commentUrl = `${base}/rest/api/3/issue/${encodeURIComponent(wi.id)}/comment`;
      await fetch(commentUrl, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: `${MARKER} CheckDiff report attached: ${fileName} (${new Date().toISOString()}) ${MARKER_END}` }) });
    } catch {}
    return { workItemRef: ref, ok: true, message: `Attached ${fileName} to ${wi.id}` };
  } catch (e: any) { return { workItemRef: ref, ok: false, message: '', error: e.message }; }
}

export async function publishReportToWorkItems(opts: { workItems: WorkItemContext[]; reportPath: string; pr?: any; repo?: string; rootDir?: string }): Promise<{ results: PublishResult[] }> {
  const results: PublishResult[] = [];
  for (const wi of opts.workItems) {
    if (wi.source === 'github') {
      results.push(await publishToGitHubIssue(wi, opts.reportPath, opts.repo, opts.pr));
    } else if (wi.source === 'ado') {
      results.push(await publishToAdo(wi, opts.reportPath));
    } else if (wi.source === 'jira') {
      results.push(await publishToJira(wi, opts.reportPath));
    } else {
      results.push({ workItemRef: `${wi.source}:${wi.id}`, ok: false, message: '', error: 'Manual work item has no remote — cannot publish' });
    }
  }
  if (results.length === 0) {
    if (opts.pr?.number && opts.repo) {
      const repo = opts.repo || env('GITHUB_REPOSITORY') || '';
      if (repo) {
        const prWi: WorkItemContext = { id: String(opts.pr.number), source: 'github', title: opts.pr.title || `PR #${opts.pr.number}`, description: '', acceptanceCriteria: [], area: '', tags: [], state: '', url: opts.pr.url };
        results.push(await publishToGitHubIssue(prWi, opts.reportPath, repo, opts.pr));
      }
    }
  }
  return { results };
}
