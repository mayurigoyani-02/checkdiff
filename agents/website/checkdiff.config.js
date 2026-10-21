export default {
  agentName: 'website',
  projectType: 'nextjs',
  mapping: {
    'pages/checkout/**': ['@checkout', '@critical', '@website'],
    'pages/cart/**': ['@cart', '@checkout'],
    'pages/auth/**': ['@auth', '@website'],
    'components/**': ['@website'],
    'styles/**': ['@visual'],
    '**/*.css': ['@visual']
  },
  e2e: {
    framework: 'playwright',
    testDir: './e2e',
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:4000'
  },
  strategy: 'impact'
}