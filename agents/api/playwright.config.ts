import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4000/health',
    reuseExistingServer: !process.env.CI
  }
});