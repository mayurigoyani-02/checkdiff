"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDiff = collectDiff;
// src/collectors/gitCollector.ts
const child_process_1 = require("child_process");
function exec(cmd) {
    try {
        return (0, child_process_1.execSync)(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch (e) {
        return e.stdout?.toString().trim() || '';
    }
}
async function collectDiff(opts) {
    const { base, head } = opts;
    let files = [];
    let diffContent = '';
    // Try committed diff first: base...head
    try {
        const diffCmd = `git diff --name-only ${base}...${head}`;
        if (opts.verbose)
            console.log(`  exec: ${diffCmd}`);
        files = exec(diffCmd).split('\n').filter(Boolean);
        diffContent = exec(`git diff ${base}...${head}`);
    }
    catch { }
    // Fallback: working directory changes (your case: HEAD vs HEAD)
    if (files.length === 0) {
        if (opts.verbose)
            console.log('  No committed changes, checking working dir...');
        const status = exec('git status --porcelain');
        files = status.split('\n')
            .filter(Boolean)
            .map(line => line.slice(3).trim())
            .filter(f => !f.includes(' -> '))
            .map(f => f.replace(/^.* -> /, ''));
        diffContent = exec('git diff HEAD');
        if (files.length > 0 && opts.verbose) {
            console.log(`  Found ${files.length} uncommitted files in working dir`);
        }
    }
    // Normalize to forward slashes for Windows
    files = files.map(f => f.replace(/\\/g, '/'));
    // Auto-ignore junk (no config needed)
    files = files.filter(f => !f.includes('node_modules') &&
        !f.includes('.git') &&
        !f.match(/package-lock\.json|yarn\.lock|\.last-run\.json|test-results/));
    return { files, diffContent, base, head };
}
