import { test, expect } from '@playwright/test';
const API = 'http://localhost:4000';

test('create payment @payment @api @critical', async ({ request }) => {
  const res = await request.post(`${API}/api/payment/create`, {
    data: { amount: 1000 }
  });
  expect(res.ok()).toBeTruthy();
});