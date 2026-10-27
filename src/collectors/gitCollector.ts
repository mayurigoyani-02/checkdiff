// src/collectors/gitCollector.ts — PR-aware + working-dir fallback
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parsePrLink } from '../utils/links';

export interface PRMeta {
  number: number;
  title: string;
  body: string;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  url: string;
  linkedIssueNumbers: number[];
}

export interface DiffResult {
  files: string[];
  diffContent: string;
  base: string;
  head: string;
  pr?: PRMeta;
  repo?: string;
  source: 'pr-github-api' | 'pr-git' | 'git-range' | 'working-dir';
}

function exec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e: any) {
    return e.stdout?.toString().trim() || '';
  }
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function parseRepoFromRemote(rootDir?: string): string | undefined {
  try {
    const url = exec('git remote get-url origin', rootDir) || exec('git config --get remote.origin.url', rootDir);
    if (!url) return undefined;
    // Handle https://github.com/owner/repo(.git) and git@github.com:owner/repo(.git)
    let m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1].replace(/\.git$/, '');
    // Generic: take last two path segments
    m = url.match(/([^/:]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1].replace(/\.git$/, '');
    return undefined;
  } catch { return undefined; }
}

function extractLinkedIssueNumbers(text: string): number[] {
  if (!text) return [];
  const nums: number[] = [];
  const re = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) nums.push(parseInt(m[1], 10));
  const re2 = /(?:#)(\d+)/g;
  // Also capture bare #123 only if PR body explicitly references it without keyword — limit to avoid noise
  return [...new Set(nums)];
}

function resolveRepo(optsRepo?: string, rootDir?: string): string | undefined {
  return optsRepo || env('GITHUB_REPOSITORY') || parseRepoFromRemote(rootDir);
}

function resolvePRNumber(optsPr?: string | number): number | undefined {
  const parsed = parsePrLink(optsPr !== undefined && optsPr !== null ? String(optsPr).trim() : '');
  if (parsed?.number) return parsed.number;
  if (optsPr !== undefined && optsPr !== null && String(optsPr).trim() !== '') {
    const n = parseInt(String(optsPr).trim(), 10);
    if (!isNaN(n)) return n;
  }
  const ref = env('GITHUB_REF') || '';
  const m = ref.match(/refs\/pull\/(\d+)\/merge/);
  if (m) return parseInt(m[1], 10);
  const envPr = env('PR_NUMBER') || env('GITHUB_PR_NUMBER') || env('CI_MERGE_REQUEST_IID');
  if (envPr && /^\d+$/.test(envPr.trim())) return parseInt(envPr.trim(), 10);
  return undefined;
}

function resolvePrRepoOverride(optsPr?: string | number): string | undefined {
  const parsed = parsePrLink(optsPr !== undefined && optsPr !== null ? String(optsPr).trim() : '');
  return parsed?.repo;
}

function githubToken(): string | undefined {
  return env('GITHUB_TOKEN') || env('GH_TOKEN') || env('GITHUB_PAT') || env('GH_PAT');
}

async function fetchPrViaGitHub(repo: string, prNumber: number): Promise<PRMeta | undefined> {
  const token = githubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!res.ok) throw new Error(`GitHub PR ${prNumber} fetch failed: ${res.status} ${await res.text().then(t => t.slice(0, 400)).catch(() => '')}`);
    const data: any = await res.json();
    const body: string = data.body || '';
    return {
      number: data.number,
      title: data.title || `PR #${prNumber}`,
      body,
      baseRef: data.base?.ref || 'main',
      headRef: data.head?.ref || `pr-${prNumber}`,
      baseSha: data.base?.sha || '',
      headSha: data.head?.sha || '',
      url: data.html_url || `https://github.com/${repo}/pull/${prNumber}`,
      linkedIssueNumbers: extractLinkedIssueNumbers(`${data.title || ''}\n${body}`),
    };
  } catch (e: any) {
    throw e;
  }
}

async function fetchPrDiffViaGitHub(repo: string, prNumber: number, verbose?: boolean): Promise<{ files: string[]; diffContent: string } | undefined> {
  const token = githubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3.diff', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!res.ok) return undefined;
    const diffContent = await res.text();
    if (!diffContent || diffContent.startsWith('{')) return undefined;
    // Also fetch files list for reliability
    const headersJson: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headersJson['Authorization'] = `Bearer ${token}`;
    let files: string[] = [];
    try {
      const filesRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100`, { headers: headersJson });
      if (filesRes.ok) {
        const filesData: any[] = await filesRes.json();
        files = filesData.map(f => f.filename as string).filter(Boolean);
      }
    } catch {}
    if (files.length === 0) {
      // Fallback: parse diff headers
      files = [...new Set([...diffContent.matchAll(/^diff --git a\/(\S+) b\//gm)].map(m => m[1]))];
    }
    if (verbose) console.log(`  GitHub API: PR #${prNumber} diff ${diffContent.length} chars, ${files.length} files`);
    return { files, diffContent };
  } catch {
    return undefined;
  }
}

function normalizeFiles(files: string[]): string[] {
  return files
    .map(f => f.replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter(f =>
      !f.includes('node_modules') &&
      !f.includes('.git') &&
      !f.match(/package-lock\.json|yarn\.lock|\.last-run\.json|test-results/)
    );
}

export async function collectDiff(opts: { base: string; head?: string; rootDir?: string; verbose?: boolean; pr?: string | number; repo?: string }) {
  const cwd = opts.rootDir || process.cwd();
  const verbose = opts.verbose;
  const prNumber = resolvePRNumber(opts.pr);
  // PR URL may already carry repo (e.g. https://github.com/owner/repo/pull/42)
  const prRepoOverride = resolvePrRepoOverride(opts.pr);
  const repo = resolveRepo(opts.repo || prRepoOverride, cwd);
  let prMeta: PRMeta | undefined;
  let files: string[] = [];
  let diffContent = '';
  let source: DiffResult['source'] = 'git-range';
  let base = opts.base || 'main';
  let head = opts.head || 'HEAD';

  // --- PR path ---
  if (prNumber && repo) {
    if (verbose) console.log(`  PR mode: #${prNumber} in ${repo}`);
    try {
      prMeta = await fetchPrViaGitHub(repo, prNumber);
      if (prMeta) {
        base = prMeta.baseRef;
        // Prefer SHAs when available for git diff
        if (prMeta.baseSha && prMeta.headSha) {
          head = prMeta.headSha;
          base = prMeta.baseSha;
        } else {
          head = prMeta.headRef;
        }
        if (verbose) console.log(`  PR meta: "${prMeta.title}" base=${base} head=${head} linkedIssues=${prMeta.linkedIssueNumbers.join(',') || 'none'}`);
      }
    } catch (e: any) {
      if (verbose) console.log(`  ⚠ PR meta fetch failed: ${e.message}`);
    }

    // Try GitHub API diff first (works even without local git fetch)
    const ghDiff = await fetchPrDiffViaGitHub(repo, prNumber, verbose);
    if (ghDiff && ghDiff.files.length > 0) {
      files = normalizeFiles(ghDiff.files);
      diffContent = ghDiff.diffContent;
      source = 'pr-github-api';
      return { files, diffContent, base, head, pr: prMeta, repo, source };
    }

    // Fallback: git diff using fetched SHAs/refs
    if (prMeta?.baseSha && prMeta?.headSha) {
      // Ensure we have the SHAs locally
      exec(`git fetch origin ${prMeta.baseSha} --depth=1`, cwd);
      exec(`git fetch origin ${prMeta.headSha} --depth=1`, cwd);
    } else {
      exec(`git fetch origin pull/${prNumber}/head:pr-${prNumber}`, cwd);
      if (prMeta?.headSha) head = prMeta.headSha;
      else head = `pr-${prNumber}`;
    }

    const diffCmd = `git diff --name-only ${base}...${head}`;
    if (verbose) console.log(`  exec (PR git): ${diffCmd}`);
    const out = exec(diffCmd, cwd);
    files = normalizeFiles(out.split('\n').filter(Boolean));
    diffContent = exec(`git diff ${base}...${head}`, cwd);
    if (files.length > 0) {
      source = 'pr-git';
      return { files, diffContent, base, head, pr: prMeta, repo, source };
    }
    // If still empty, fall through to normal git/working-dir logic
    if (verbose) console.log(`  PR git diff empty, falling back to normal git diff`);
  } else if (prNumber && !repo) {
    console.log(`  ⚠ --pr ${prNumber} given but repo could not be resolved. Set --repo owner/repo or GITHUB_REPOSITORY, or set git remote origin.`);
  }

  // --- Normal git range ---
  try {
    // GITHUB_BASE_REF takes precedence in CI (Actions sets it for PRs)
    const ciBase = env('GITHUB_BASE_REF');
    if (ciBase && !opts.pr && base === 'main') base = ciBase;
    const diffCmd = `git diff --name-only ${base}...${head}`;
    if (verbose) console.log(`  exec: ${diffCmd}`);
    files = exec(diffCmd, cwd).split('\n').filter(Boolean);
    diffContent = exec(`git diff ${base}...${head}`, cwd);
    if (files.length > 0) {
      files = normalizeFiles(files);
      source = 'git-range';
      return { files, diffContent, base, head, pr: prMeta, repo, source };
    }
  } catch {}

  // Fallback: working directory changes
  if (verbose) console.log('  No committed changes, checking working dir...');
  const status = exec('git status --porcelain', cwd);
  files = status.split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .filter(f => !f.includes(' -> '))
    .map(f => f.replace(/^.* -> /, ''));

  diffContent = exec('git diff HEAD', cwd);
  if (!diffContent) diffContent = exec('git diff', cwd);

  files = normalizeFiles(files);
  source = 'working-dir';
  if (files.length > 0 && verbose) {
    console.log(`  Found ${files.length} uncommitted files in working dir`);
  }

  return { files, diffContent, base, head, pr: prMeta, repo, source };
}