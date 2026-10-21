export default {
  agentName: 'api',
  projectType: 'express',
  mapping: {   
    'src/index.js': ['@all', '@api']    
  },
  e2e: {
    framework: 'playwright',
    testDir: './e2e',
    baseUrl: 'http://localhost:4000'
  },
  strategy: 'impact'
}