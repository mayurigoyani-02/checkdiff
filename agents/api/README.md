
Verify it works first:
```bash
# Terminal 1 - API
cd agents/api && npm install && npm run dev
# -> http://localhost:4000/health



#### **PART B: Setup for API Agent**

```bash
cd ../api  # from website to api
```

**Step 1: Install Playwright**
```bash
npm install -D @playwright/test
npx playwright install
```

**Step 2: Init Playwright (API mode)**
```bash
# Don't run init, create config manually for API
```
Create `playwright.config.ts`:
```ts
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
```

**Step 3: Install CheckDiff**
```bash
npm install -D checkdiff-e2e
# OR if using local package from before:
npm install -D /path/to/checkdiff-e2e - C:\Hackathon\CheckDiff\agents\api> npm install -D ../../
```

**Step 4: Create API CheckDiff Config**
Create `checkdiff.config.js` in `agents/api/`:
```js
export default {
  agentName: 'api',
  projectType: 'express',
  mapping: {
    'src/routes/auth.*': ['@auth', '@api', '@critical'],
    'src/routes/payment.*': ['@payment', '@api', '@critical'],
    'src/routes/product.*': ['@product', '@api'],
    'src/index.js': ['@all', '@api'],
    'src/middleware/**': ['@critical', '@all']
  },
  e2e: {
    framework: 'playwright',
    testDir: './e2e',
    baseUrl: 'http://localhost:4000'
  },
  strategy: 'impact'
}
```
Note: Since your API is `src/index.js` (single file), adjust mapping if you split into routes later.

**Step 5: Create API E2E Tests**
Create `e2e/auth.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
const API = 'http://localhost:4000';

test('API health @api', async ({ request }) => {
  const res = await request.get(`${API}/health`);
  expect(res.ok()).toBeTruthy();
});

test('login success @auth @api @critical', async ({ request }) => {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'test@example.com', password: 'password123' }
  });
  expect(res.ok()).toBeTruthy();
});

test('login fail @auth @api', async ({ request }) => {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'wrong', password: 'wrong' }
  });
  expect(res.status()).toBe(401);
});
```

Create `e2e/payment.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
const API = 'http://localhost:4000';

test('create payment @payment @api @critical', async ({ request }) => {
  const res = await request.post(`${API}/api/payment/create`, {
    data: { amount: 1000 }
  });
  expect(res.ok()).toBeTruthy();
});
```

**Step 6: Test White-Box Mode**
```bash
# Make fake API change
echo "// payment fix" >> src/index.js

npx checkdiff run --base main --dry
# Expected: Impact @all or @api

npx checkdiff run --base main

git checkout -- src/index.js
```

