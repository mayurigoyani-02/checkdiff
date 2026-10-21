"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiImpact = aiImpact;
// src/ai/impactAnalyzer.ts - No hardcoding, uses discovered tags
const testParser_1 = require("../analyzer/testParser");
async function callLLM(prompt) {
    const apiKey = process.env.CHECKDIFF_AI_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { tags: [], confidence: 0, reason: 'No AI key, using graph only' };
    }
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.1
            })
        });
        const data = await res.json();
        return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    }
    catch {
        return { tags: [], confidence: 0, reason: 'AI call failed' };
    }
}
async function aiImpact(changedFiles, diffContent, rootDir) {
    const { allTags, tests } = (0, testParser_1.discoverAllTags)(rootDir);
    if (allTags.size === 0) {
        return { tags: ['@critical'], confidence: 0.5, reason: 'No tags discovered, fallback to @critical' };
    }
    // Extract keywords from changed files for prompt
    const changedPreview = diffContent.slice(0, 5000);
    const prompt = `
You are test impact analyzer. Return JSON: { "tags": ["@payment"], "confidence": 0.9, "reason": "PaymentService.createPayment changed" }

PROJECT TAGS (auto-discovered, ONLY use these):
${[...allTags].join(', ')}

CHANGED FILES:
${changedFiles.join('\n')}

DIFF:
${changedPreview}

TESTS (path -> tags -> first 200 chars):
${tests.map(t => `${t.path.split('/').pop()}: [${t.tags.join(', ')}] classes=${t.classes.join(',')} methods=${t.methods.join(',')}`).join('\n')}

TASK: Which tags are impacted? Use class/method names from diff to match test tags.
If README/package-lock/test-results => []
If minor util change not matching any tag => []
If core file but only logging => []
If major core change => ["@critical"] or ["@all"] if you must
`;
    const result = await callLLM(prompt);
    // Validate tags exist in project
    const validTags = result.tags.filter(t => allTags.has(t) || t === '@all' || t === '@critical');
    return { ...result, tags: validTags };
}
