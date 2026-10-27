// src/report/htmlReport.ts - generates report page
import fs from 'fs';
import path from 'path';
import { CheckDiffResult } from '../index';

export interface TestExecutionResult {
  file: string;
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
}

export function generateHtmlReport(result: CheckDiffResult, executionResults: TestExecutionResult[], outputPath: string) {
  const total = executionResults.length;
  const passed = executionResults.filter(r => r.success).length;
  const failed = total - passed;
  const ctx: any = (result as any).context;
  const diff: any = (result as any).diff;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>CheckDiff Report - ${new Date().toLocaleString()}</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #0f0f0f; color: #e0e0e0; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat { background: #1e1e1e; padding: 20px; border-radius: 8px; text-align: center; }
    .stat.pass { border-left: 4px solid #10b981; } .stat.fail { border-left: 4px solid #ef4444; }
    .stat.total { border-left: 4px solid #3b82f6; } .stat.port { border-left: 4px solid #f59e0b; }
    .card { background: #1e1e1e; padding: 20px; border-radius: 8px; margin: 15px 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; margin: 2px; }
    .badge.route { background: #3b82f6; } .badge.config { background: #f59e0b; } .badge.code { background: #8b5cf6; } .badge.infra { background: #ef4444; }
    .endpoint { background: #2a2a2a; padding: 12px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; }
    .endpoint.success { border-left: 3px solid #10b981; } .endpoint.fail { border-left: 3px solid #ef4444; }
    .btn { background: #667eea; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 5px; border: none; cursor: pointer; }
    .btn:hover { background: #5a67d8; }
    pre { background: #0a0a0a; padding: 15px; border-radius: 6px; overflow-x: auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) { .stats, .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 CheckDiff Test Report</h1>
    <p>API: ${result.apiUrl} | Generated: ${new Date().toLocaleString()}</p>
    <p>Command: <code>${result.command}</code></p>
    ${diff ? `<p>Diff: <code>${diff.source || 'git'}</code> — base <code>${diff.base}</code> ... head <code>${String(diff.head).slice(0, 12)}</code> — ${diff.files.length} file(s)${diff.pr ? ` — <a style="color:#fff;text-decoration:underline" href="${diff.pr.url}" target="_blank">PR #${diff.pr.number}: ${diff.pr.title}</a> ${diff.repo ? `(${diff.repo})` : ''}` : ''}${diff.repo && !diff.pr ? ` — ${diff.repo}` : ''}</p>` : ''}
    ${diff?.pr?.linkedIssueNumbers?.length ? `<p>Linked Issues: ${diff.pr.linkedIssueNumbers.map((n: number) => `<a style="color:#fff;text-decoration:underline" href="https://github.com/${diff.repo}/issues/${n}" target="_blank">#${n}</a>`).join(', ')}</p>` : ''}
  </div>

  <div class="stats">
    <div class="stat total"><h2>${total}</h2><p>Total Tests</p></div>
    <div class="stat pass"><h2>${passed}</h2><p>Passed</p></div>
    <div class="stat fail"><h2>${failed}</h2><p>Failed</p></div>
    <div class="stat port"><h2>${result.port}</h2><p>Port: ${result.apiUrl}</p></div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>📁 Changed Files Classification</h3>
      ${result.classified.map(c => `
        <div style="margin:10px 0; padding:10px; background:#2a2a2a; border-radius:6px;">
          <span class="badge ${c.type}">${c.type}/${c.subType}</span>
          <strong>${c.file}</strong><br>
          <small>Impacted: ${c.impactedEndpoints.join(', ') || c.endpoints.join(', ') || 'all'}</small>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>🧪 Test Profiles Generated</h3>
      ${result.profiles.map(p => `
        <div style="margin:10px 0;">
          <strong>${p.change.file}</strong> (${p.testCases.length} cases)<br>
          ${p.testCases.map(tc => `<span class="badge">${tc.method} ${tc.endpoint}</span>`).join('')}
          <pre>${JSON.stringify(p.testData, null, 2)}</pre>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="card">
    <h3>🧠 Work-Item Context</h3>
    ${ctx ? `
      <p>Work items: ${ctx.workItems.length} | Gaps: ${ctx.gaps.length}</p>
      ${(ctx.workItems || []).map((w: any) => `
        <div style="margin:10px 0; padding:10px; background:#2a2a2a; border-radius:6px;">
          <strong>${w.source}:${w.id}</strong> — ${w.title || ''}
          ${w.url ? `<a class="btn" href="${w.url}" target="_blank">Open</a>` : ''}
          ${(w.acceptanceCriteria || []).length ? `<br><small>Acceptance: ${(w.acceptanceCriteria || []).join(' | ').slice(0, 400)}</small>` : ''}
        </div>
      `).join('')}
      <h4>⚠ Gaps</h4>
      ${(ctx.gaps || []).length ? (ctx.gaps || []).map((g: any) => `
        <div style="margin:8px 0; padding:10px; background:#2a2a2a; border-radius:6px; border-left:3px solid ${g.severity === 'high' ? '#ef4444' : g.severity === 'medium' ? '#f59e0b' : '#3b82f6'};">
          <strong>[${g.severity}] ${g.category}</strong><br>${g.message}<br><small>Suggestion: ${g.suggestion}</small>
        </div>
      `).join('') : '<p>No gaps detected.</p>'}
    ` : '<p>Context learning disabled.</p>'}
  </div>

  <div class="card">
    <h3>🚀 Endpoint Execution Results (Auto-Run)</h3>
    ${executionResults.map(r => `
      <div class="endpoint ${r.success ? 'success' : 'fail'}">
        <div>
          <strong>${r.method} ${r.endpoint}</strong> 
          <span class="badge ${r.success ? 'route' : 'infra'}">${r.status} ${r.success ? 'OK' : 'FAIL'}</span>
          <br><small>${r.file} | ${r.duration}ms ${r.error ? `| Error: ${r.error}` : ''}</small>
        </div>
        <div>
          <a class="btn" href="${result.apiUrl}${r.endpoint}" target="_blank">Open in Browser</a>
          <a class="btn" href="${result.apiUrl}/api-docs" target="_blank">Swagger</a>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h3>📋 How to Test Manually</h3>
    <h4>Browser:</h4>
    ${result.profiles.flatMap(p => p.change.impactedEndpoints).slice(0,5).map(ep => {
      const route = ep.split(' ')[1] || ep;
      return `<a class="btn" href="${result.apiUrl}${route}" target="_blank">${result.apiUrl}${route}</a>`;
    }).join('')}
    <h4>Swagger:</h4>
    <a class="btn" href="${result.apiUrl}/api-docs" target="_blank">Open ${result.apiUrl}/api-docs</a>
    <h4>Playwright:</h4>
    <pre>${result.command} --ui</pre>
    <pre>npx playwright test e2e/auto --ui</pre>
  </div>

  <script>
    // Auto-refresh every 10s if ?live
    if (location.search.includes('live')) setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
  return outputPath;
}