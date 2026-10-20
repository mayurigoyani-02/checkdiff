import { test, expect } from '@playwright/test';

test('homepage @visual', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.*/);
});

test('checkout flow @checkout @critical:checkout', async ({ page }) => {
  // your checkout test
});

test('auth @auth', async ({ page }) => {
  // login test
});
