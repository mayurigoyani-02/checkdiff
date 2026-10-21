# Terminal 2 - Website
cd agents/website && npm install && npm run dev
# -> http://localhost:3000

#### **PART A: Setup for Website Agent**

```bash
cd agents/website
```
**Step 1: Install CheckDiff**
```bash
npm install -D checkdiff-e2e
# OR if using local package from before:
npm install -D /path/to/checkdiff-e2e - 
npm install -D ../../
```

**Step 2: Create Website CheckDiff Config**
Create `checkdiff.config.js` in `agents/website/`:
```js
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
```

**Step 3: Create Your First E2E Test (with tags)**
Create `e2e/checkout.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('checkout loads @checkout @website', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.locator('[data-testid="cart-summary"]')).toBeVisible();
});

test('coupon flow @checkout @critical @website', async ({ page }) => {
  await page.goto('/checkout');
  await page.fill('[data-testid="coupon-input"]', 'SAVE10');
  await page.click('[data-testid="apply-coupon"]');
});
```

Create `e2e/auth.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('login page @auth @website', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('[data-testid="email"]')).toBeVisible();
});
```

**Step 4: Test White-Box Mode**
```bash
# Make a fake change
echo "// change" >> pages/checkout/index.tsx

# Dry run - shows what WOULD be tested
npx checkdiff run --base main --dry
# Expected: Impact @checkout, will run --grep @checkout

# Real run
npx checkdiff run --base main

# Revert
git checkout -- pages/checkout/index.tsx
```
