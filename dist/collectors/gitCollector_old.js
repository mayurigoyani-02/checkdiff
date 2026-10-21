"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDiff = collectDiff;
const simple_git_1 = require("simple-git");
async function collectDiff(base = 'main', head = 'HEAD') {
    const git = (0, simple_git_1.simpleGit)();
    // 1. Find git root (works from agents/api, agents/website, root)
    let root = '';
    try {
        root = (await git.revparse(['--show-toplevel'])).trim();
    }
    catch {
        root = process.cwd();
    }
    const gitRoot = (0, simple_git_1.simpleGit)(root);
    // 2. Resolve base branch - try origin/main, main, HEAD~1
    let actualBase = base;
    const candidates = [base, `origin/${base}`, 'origin/main', 'main', 'master', 'origin/master'];
    for (const c of candidates) {
        try {
            await gitRoot.revparse([c]);
            actualBase = c;
            break;
        }
        catch {
            // try next
        }
    }
    console.log(`Git root: ${root}`);
    console.log(`Using base: ${actualBase} vs head: ${head}`);
    // 3. Get committed changes
    let files = [];
    try {
        const summary = await gitRoot.diffSummary([`${actualBase}...${head}`]);
        files = summary.files.map((f) => f.file);
    }
    catch (e) {
        console.log(`Diff ${actualBase}...${head} failed, trying HEAD`);
    }
    // 4. If 0 committed files, check WORKING DIR changes
    if (files.length === 0) {
        console.log('No committed changes found, checking working directory...');
        const status = await gitRoot.status();
        files = [
            ...status.modified,
            ...status.not_added,
            ...status.created,
            ...status.renamed.map((r) => r.to),
            ...status.staged
        ].filter(Boolean);
        files = [...new Set(files)];
        if (files.length > 0) {
            console.log(`Found ${files.length} uncommitted files in working dir`);
        }
    }
    // 5. Get raw diff for AI mode
    let raw = '';
    try {
        raw = await gitRoot.diff([`${actualBase}...${head}`]);
        if (!raw && files.length > 0) {
            raw = await gitRoot.diff(['HEAD']);
        }
    }
    catch { }
    return {
        mode: 'git',
        files,
        raw,
        base: actualBase,
        head,
        root
    };
}
