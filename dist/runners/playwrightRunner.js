"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlaywright = runPlaywright;
const child_process_1 = require("child_process");
async function runPlaywright(profile, config) {
    console.log(`\n▶ Running: ${profile.command}`);
    // In real implementation, spawn playwright
    // For scaffold, simulate
    if (process.env.CHECKDIFF_DRY) {
        return { passed: profile.testFiles.length, failed: 0, summary: '[dry-run] would run: ' + profile.command };
    }
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)('npx', ['playwright', 'test', '--grep', profile.tags.join('|'), '--reporter=list'], { stdio: 'inherit', shell: true });
        child.on('close', (code) => {
            resolve({ passed: code === 0 ? 1 : 0, failed: code === 0 ? 0 : 1, summary: code === 0 ? '✅ All impacted tests passed' : '❌ Impacted tests failed' });
        });
        child.on('error', () => {
            resolve({ passed: 0, failed: 0, summary: '⚠️  Playwright not found - install with npx playwright install' });
        });
    });
}
