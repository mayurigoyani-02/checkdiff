// Universal config - works for any stack
// This file is OPTIONAL. Auto-detection works without it.

export default {
  // auto-detected if not set: nextjs, react, vue, express, django, fastapi, wordpress, shopify, static
  projectType: 'auto',

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
