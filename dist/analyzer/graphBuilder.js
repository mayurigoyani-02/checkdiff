"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAffectedTests = findAffectedTests;
exports.buildGraph = buildGraph;
// src/analyzer/graphBuilder.ts - Extracts class/method from CHANGED files too
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const testParser_1 = require("./testParser");
function extractKeywordsFromCode(content) {
    const keywords = new Set();
    const regexes = [
        /class\s+(\w+)/g,
        /(?:function|const|let|var)\s+(\w+)/g,
        /\/api\/([\w-]+)/g,
    ];
    for (const regex of regexes) {
        let m;
        while ((m = regex.exec(content)) !== null) {
            const parts = m[1].split(/(?=[A-Z])|[-_]/).map(p => p.toLowerCase().replace(/[^a-z]/g, ''));
            parts.forEach(p => { if (p.length >= 3)
                keywords.add(p); });
        }
    }
    return [...keywords];
}
async function findAffectedTests(changedFiles, rootDir) {
    const { allTags, tests } = (0, testParser_1.discoverAllTags)(rootDir);
    if (tests.length === 0) {
        return { affected: [], allTags, tests, reason: 'No e2e tests found' };
    }
    // Extract keywords from changed files
    const changedKeywords = new Set();
    const changedTags = new Set();
    for (const file of changedFiles) {
        try {
            const fullPath = path_1.default.isAbsolute(file) ? file : path_1.default.join(rootDir, file);
            if (!fs_1.default.existsSync(fullPath))
                continue;
            const content = fs_1.default.readFileSync(fullPath, 'utf8');
            extractKeywordsFromCode(content).forEach(k => changedKeywords.add(k));
            (0, testParser_1.extractTagsFromTestFile)(content).forEach(t => {
                changedTags.add(t);
                changedKeywords.add(t.replace('@', ''));
            });
        }
        catch { }
    }
    console.log(`  Changed keywords: ${[...changedKeywords].join(', ') || 'none'}`);
    console.log(`  Project tags: ${[...allTags].join(', ')}`);
    // Match: if changed file contains "payment", find tests that contain @payment
    const affected = [];
    for (const test of tests) {
        for (const kw of changedKeywords) {
            if (test.tags.includes(`@${kw}`) || test.content.toLowerCase().includes(kw)) {
                affected.push(test);
                break;
            }
        }
        // Also check explicit tag overlap
        for (const tag of changedTags) {
            if (test.tags.includes(tag)) {
                if (!affected.includes(test))
                    affected.push(test);
                break;
            }
        }
    }
    // If src/index.js or app.ts changed with many keywords -> fallback to @critical
    const isCoreChange = changedFiles.some(f => /src\/index|src\/app|src\/server/.test(f));
    if (affected.length === 0 && isCoreChange) {
        const criticalTests = tests.filter(t => t.tags.includes('@critical'));
        return {
            affected: criticalTests.length ? criticalTests : tests.slice(0, 2),
            allTags, tests,
            reason: `Core file changed (${changedFiles.join(', ')}) - running critical tests`,
            changedKeywords: [...changedKeywords]
        };
    }
    return {
        affected,
        allTags,
        tests,
        reason: `${changedFiles.length} files -> keywords ${[...changedKeywords].join(', ')} -> ${affected.length} tests`,
        changedKeywords: [...changedKeywords]
    };
}
async function buildGraph(rootDir) {
    // Kept for compatibility - now logic is in findAffectedTests
    return { fileToImports: new Map(), importToFiles: new Map() };
}
