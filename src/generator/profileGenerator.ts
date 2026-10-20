export type TestProfile = { tags: string[], testFiles: string[], command: string };

export async function generateProfile(impact: { tags: string[], files: string[] }, config: any): Promise<TestProfile> {
  // MVP: converts tags to playwright --grep
  // In full version: read e2e/*.spec.ts and filter by tag in file content
  const tagGrep = impact.tags.map(t => t.replace('@','')).join('|');
  return {
    tags: impact.tags,
    testFiles: impact.files,
    command: `npx playwright test --grep "${tagGrep}"`
  };
}
