"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = exports.mapImpact = exports.collectDiff = void 0;
exports.checkdiff = checkdiff;
// src/index.ts
const gitCollector_1 = require("./collectors/gitCollector");
const impactMapper_1 = require("./mapper/impactMapper");
const testRunner_1 = require("./runner/testRunner");
async function checkdiff(options = {}) {
    const base = options.base || 'origin/main';
    const head = options.head || 'HEAD';
    // STEP 1: gitCollector - Get changed files from git
    // This is where your "Found 6 changed files" log comes from
    if (options.verbose)
        console.log(`\n🔍 Collecting diff ${base}...${head}`);
    const diff = await (0, gitCollector_1.collectDiff)({ base, head, verbose: options.verbose });
    if (diff.files.length === 0) {
        console.log('✔ No changes detected');
        return { diff, impact: { tags: [], files: [], reason: 'No changes', command: 'echo "skip"' } };
    }
    console.log(`✔ Found ${diff.files.length} changed files`);
    if (options.verbose) {
        diff.files.forEach(f => console.log(`  - ${f}`));
    }
    // STEP 2: impactMapper - Graph + AI decides which tests
    // No checkdiff.config.js - auto-detected
    const impact = await (0, impactMapper_1.mapImpact)(diff, {
        ai: options.ai,
        rootDir: process.cwd(),
        verbose: options.verbose
    });
    console.log(`\nImpact: ${impact.tags.length ? impact.tags.join(', ') : 'none'}`);
    console.log(`Reason: ${impact.reason}`);
    console.log(`\nTest Profile: ${impact.files.length} files, ${impact.tags.join(' ') || 'no impact'}`);
    console.log(`\n▶ Running: ${impact.command}\n`);
    if (options.dry) {
        return { diff, impact };
    }
    // STEP 3: testRunner - Run impacted tests
    const testResult = await (0, testRunner_1.runTests)(impact.command, { verbose: options.verbose });
    if (!testResult.success) {
        console.error('\n❌ Impacted tests failed');
        if (options.verbose)
            console.error(testResult.output);
    }
    else {
        console.log('\n✔ Impacted tests passed');
    }
    return { diff, impact, testResult };
}
// For programmatic use
var gitCollector_2 = require("./collectors/gitCollector");
Object.defineProperty(exports, "collectDiff", { enumerable: true, get: function () { return gitCollector_2.collectDiff; } });
var impactMapper_2 = require("./mapper/impactMapper");
Object.defineProperty(exports, "mapImpact", { enumerable: true, get: function () { return impactMapper_2.mapImpact; } });
var testRunner_2 = require("./runner/testRunner");
Object.defineProperty(exports, "runTests", { enumerable: true, get: function () { return testRunner_2.runTests; } });
