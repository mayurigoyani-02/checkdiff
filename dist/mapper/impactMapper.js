"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapImpact = mapImpact;
// src/mapper/impactMapper.ts
const graphBuilder_1 = require("../analyzer/graphBuilder");
const impactAnalyzer_1 = require("../ai/impactAnalyzer");
async function mapImpact(diff, opts) {
    let files = (diff.files || []).filter((f) => !/package-lock|yarn\.lock|README|\.last-run|test-results|node_modules|\.git/.test(f));
    if (files.length === 0) {
        return { tags: [], files: [], reason: 'Only ignored files (README, lock files, etc)', command: 'echo "No tests needed"' };
    }
    // Layer 1: Graph + dynamic tag extraction (no hardcoding)
    const graphResult = await (0, graphBuilder_1.findAffectedTests)(files, opts.rootDir);
    let tags = [...new Set(graphResult.affected.flatMap(t => t.tags))];
    // Layer 2: AI refinement if enabled
    if (opts.ai) {
        const aiResult = await (0, impactAnalyzer_1.aiImpact)(files, diff.diffContent || '', opts.rootDir);
        if (aiResult.tags.length > 0) {
            tags = aiResult.tags;
            graphResult.reason = `${graphResult.reason} | AI: ${aiResult.reason} (conf: ${aiResult.confidence})`;
        }
    }
    if (tags.length === 0) {
        // If we changed files but found no matching tests, run @critical as safety
        tags = ['@critical'];
        graphResult.reason += ' | No direct match, fallback to @critical';
    }
    // NEVER return @all with grep "all" - return actual tests
    const command = tags.includes('@all')
        ? 'npx playwright test'
        : `npx playwright test --grep "${tags.join('|')}"`;
    return {
        tags,
        files,
        reason: graphResult.reason,
        command,
        affectedTests: graphResult.affected.map(t => t.path)
    };
}
