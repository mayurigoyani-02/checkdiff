// src/profile/testProfileBuilder.ts - generates real profiles for index.js
import { ClassifiedChange } from '../analyzer/changeClassifier';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TestProfile {
  change: ClassifiedChange;
  gitHistory: { hash: string; message: string; date: string; author: string }[];
  testCases: { title: string; tag: string; endpoint: string; method: string; payload?: any; expectedStatus: number }[];
  testData: Record<string, any>;
}

export function getBacktrack(file: string, rootDir: string, depth = 5) {
  try {
    const log = execSync(`git log --pretty=format:"%h|%s|%ad|%an" --date=short -n ${depth} -- "${file}"`, { cwd: rootDir, encoding: 'utf8' });
    return log.split('\n').filter(Boolean).map(line => {
      const [hash, message, date, author] = line.split('|');
      return { hash, message, date, author };
    });
  } catch { return []; }
}

export function buildTestProfiles(classified: ClassifiedChange[], rootDir: string): TestProfile[] {
  return classified.map(change => {
    const history = getBacktrack(change.file, rootDir);
    const testCases: TestProfile['testCases'] = [];
    const testData: Record<string, any> = {};

    // For index.js or config -> test ALL endpoints
    const endpointsToTest = change.impactedEndpoints.length ? change.impactedEndpoints : change.endpoints;

    endpointsToTest.forEach(epStr => {
      const parts = epStr.split(' ');
      const method = parts[0] || 'GET';
      const route = parts[1] || parts[0] || '/api/health';
      
      // Generate payload based on route
      let payload: any = undefined;
      let expectedStatus = 200;
      
      if (route.includes('payment') && method === 'POST') {
        payload = { amount: 100, currency: 'USD', paymentMethod: 'card', userId: 'test-123' };
        testData.payment = payload;
      } else if (route.includes('auth') || route.includes('login')) {
        payload = method === 'POST' ? { email: 'test@example.com', password: 'Test@123' } : undefined;
        testData.auth = payload;
      } else if (route.includes('api') && method === 'POST') {
        payload = { name: 'test', value: 'test-data' };
      }

      const tag = route.includes('payment') ? '@payment' :
                  route.includes('auth') ? '@auth' :
                  route.includes('health') ? '@health' : '@api';

      testCases.push({
        title: `Verify ${method} ${route} after ${change.subType}`,
        tag,
        endpoint: route,
        method,
        payload,
        expectedStatus
      });
    });

    if (testCases.length === 0) {
      testCases.push({
        title: `Smoke: ${change.file} - server starts and health check passes`,
        tag: '@critical',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200
      });
      testData.health = { status: 'ok' };
    }

    return {
      change,
      gitHistory: history,
      testCases,
      testData
    };
  });
}


export function generatePlaywrightTestFile(profile: TestProfile, outDir: string, rootDir: string, apiUrl = 'http://localhost:4000') {
  const safeName = profile.change.file.replace(/[^a-z0-9]/gi, '_');
  const filePath = path.join(outDir, `${safeName}.spec.ts`);

  const tests = profile.testCases.map(tc => `
test('${tc.title} ${tc.tag} @auto', async ({ request }) => {
  const response = await request.${tc.method.toLowerCase()}('${apiUrl}${tc.endpoint}', {
    ${tc.payload ? `data: ${JSON.stringify(tc.payload, null, 2)}` : ''}
  });
  expect(response.status()).toBeLessThan(500);
});
`).join('\n');

  const content = `import { test, expect } from '@playwright/test';
// Auto-generated for ${profile.change.file} at ${apiUrl}
test.describe('Profile: ${profile.change.file}', () => {
${tests}
});
`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}