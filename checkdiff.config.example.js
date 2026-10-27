// Universal config - works for any stack
// This file is OPTIONAL. Auto-detection works without it.

export default {
  // auto-detected if not set: nextjs, react, vue, express, django, fastapi, wordpress, shopify, static
  projectType: 'auto',

  // Context learning: work items -> test profiles -> gap detection.
  // Knowledge accumulates in .checkdiff/product-knowledge.json across runs.
  // Minimal CLI: --pr <PR-URL-or-number> + --workItem <work-item-URL-or-key> — CI enforces the link.
  //   GitHub Issue: https://github.com/owner/repo/issues/123 or "#123" or "owner/repo#123"
  //   ADO: https://dev.azure.com/org/project/_workitems/edit/123 or "123"
  //   Jira: "PROJ-123"
  // PR diff: from --pr URL/number (or GITHUB_REF in CI), else base...head / working dir.
  // CI: .github/workflows/checkdiff.yml checks every PR has a work item, runs report, and uploads it to the work item.
  // Additional flags: --requireWorkItem (gate, exit 2 if unlinked), --publishToWorkItem (attach report to work item).
  // Auth: GitHub needs GITHUB_TOKEN (auto in Actions) for private repos; ADO needs ADO_ORG+ADO_PAT; Jira needs JIRA_BASE_URL+JIRA_API_TOKEN.
  context: {
    learn: true,
  },

  // White-box mode: map code changes to test tags
  mapping: {
    'src/pages/checkout/**': ['@critical:checkout'],
    'src/api/payment/**': ['@payment', '@critical'],
    'src/components/auth/**': ['@auth'],
    '**/*.css': ['@visual'],
    'prisma/schema.prisma': ['@db', '@critical']
  },

  // Black-box mode: for any live website
  blackBox: {
    // url: 'https://your-site.com',
    // sitemap: true,
    // openapi: 'https://your-site.com/openapi.json'
  },

  e2e: {
    framework: 'playwright', // or cypress, api
    testDir: './e2e',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000'
  },

  // How to decide test profile
  strategy: 'impact', // 'impact' | 'all-related' | 'ai'
  
  ai: {
    enabled: false,
    provider: 'openai' // uses CHECKDIFF_AI_KEY
  }
}
