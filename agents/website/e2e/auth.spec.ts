import { test, expect } from '@playwright/test';

test('login page @auth @website', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('[data-testid="email"]')).toBeVisible();
});