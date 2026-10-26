// Universal config - works for any stack
// This file is OPTIONAL. Auto-detection works without it.

export default {
  // auto-detected if not set: nextjs, react, vue, express, django, fastapi, wordpress, shopify, static
  projectType: 'auto',

  // Context learning: work items -> test profiles -> gap detection.
  // Knowledge accumulates in .checkdiff/product-knowledge.json across runs.
  // Diff: reads PR diff when --pr <number> (or GITHUB_REF), otherwise git base...head or working dir.
  // Issues: GitHub Issues for context (linked via PR "Fixes #123" or explicit --issue "#123,owner/repo#456").
  // Link a work item: --workItem "123" (ADO/Jira/GitHub), --issue "#123" (GitHub), --pr 42 --repo owner/repo.
  // GitHub: needs GITHUB_TOKEN (or GITHUB_PAT/GH_TOKEN) for private repos; public works without token (rate-limited).
  // ADO: needs ADO_ORG (+ADO_PROJECT) + ADO_PAT. Jira: needs JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN.
  // Auto-linked: branch names with AB#123 / PROJ-456 / #123 or issue numbers. Use --no-learn to disable.
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
