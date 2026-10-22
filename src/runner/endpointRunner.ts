// src/runner/endpointRunner.ts
import { TestProfile } from '../profile/testProfileBuilder';

export function generateSwaggerCurl(profile: TestProfile, rootDir: string, apiUrl = 'http://localhost:4000') {
  return profile.testCases.filter(tc => tc.endpoint).map(tc => {
    const method = tc.method || 'GET';
    return `curl -X ${method} ${apiUrl}${tc.endpoint} -H "Content-Type: application/json" ${tc.payload ? `-d '${JSON.stringify(tc.payload)}'` : ''}`;
  }).join('\n');
}

export function generateBrowserLinks(profile: TestProfile, rootDir: string, apiUrl = 'http://localhost:4000') {
  return {
    baseUrl: apiUrl,
    swagger: `${apiUrl}/api-docs`,
    endpointSwagger: profile.change.routes.map(r => `${apiUrl}/api-docs#${r}`),
    directApi: profile.change.impactedEndpoints.map(ep => {
      const route = ep.split(' ')[1] || ep;
      return `${apiUrl}${route.startsWith('/') ? route : `/${route}`}`;
    }),
    playwrightUI: `npx playwright test --ui --grep "${profile.testCases.map(t => t.tag).join('|')}"`,
    port: apiUrl.includes(':') ? apiUrl.split(':').pop() : '4000'
  };
}