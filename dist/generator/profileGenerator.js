export async function generateProfile(impact, config) {
    // MVP: converts tags to playwright --grep
    // In full version: read e2e/*.spec.ts and filter by tag in file content
    const tagGrep = impact.tags.map(t => t.replace('@', '')).join('|');
    return {
        tags: impact.tags,
        testFiles: impact.files,
        command: `npx playwright test --grep "${tagGrep}"`
    };
}
