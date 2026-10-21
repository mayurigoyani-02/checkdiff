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