// src/runner/autoRunner.ts - auto runs test profiles against live API
import { TestProfile } from '../profile/testProfileBuilder';
import { TestExecutionResult } from '../report/htmlReport';

export async function autoRunProfiles(profiles: TestProfile[], apiUrl: string): Promise<TestExecutionResult[]> {
  const results: TestExecutionResult[] = [];
  
  for (const profile of profiles) {
    for (const tc of profile.testCases) {
      const start = Date.now();
      try {
        const url = `${apiUrl}${tc.endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
          method: tc.method,
          headers: { 'Content-Type': 'application/json' },
          body: tc.payload ? JSON.stringify(tc.payload) : undefined,
          signal: controller.signal as any
        });
        
        clearTimeout(timeout);
        const duration = Date.now() - start;
        let body: any = null;
        try { body = await response.json(); } catch { body = await response.text().catch(() => null); }
        
        results.push({
          file: profile.change.file,
          endpoint: tc.endpoint,
          method: tc.method,
          status: response.status,
          success: response.status < 500, // Server didn't crash = success for infra change
          duration,
          response: body
        });
        
        console.log(`  ${response.status < 400 ? '✔' : '✖'} ${tc.method} ${tc.endpoint} -> ${response.status} (${duration}ms)`);
        
      } catch (e: any) {
        const duration = Date.now() - start;
        results.push({
          file: profile.change.file,
          endpoint: tc.endpoint,
          method: tc.method,
          status: 0,
          success: false,
          duration,
          error: e.message
        });
        console.log(`  ✖ ${tc.method} ${tc.endpoint} -> ERROR: ${e.message}`);
      }
    }
  }
  
  return results;
}