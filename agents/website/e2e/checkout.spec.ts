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