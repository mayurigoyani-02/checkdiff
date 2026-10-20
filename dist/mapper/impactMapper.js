import { minimatch } from './minimatch.js';
export async function mapImpact(diff, config, stack) {
    const mapping = config?.mapping || {};
    const tags = new Set();
    let matchedFiles = [];
    if (diff.mode === 'black-box') {
        return { tags: ['@blackbox'], files: [], reason: `Black-box crawl of ${diff.url}` };
    }
    for (const file of diff.files) {
        for (const [pattern, patternTags] of Object.entries(mapping)) {
            if (minimatch(file, pattern)) {
                matchedFiles.push(file);
                patternTags.forEach(t => tags.add(t));
            }
        }
    }
    // Fallback heuristics if no mapping
    if (tags.size === 0) {
        for (const f of diff.files) {
            if (f.includes('auth'))
                tags.add('@auth');
            if (f.includes('checkout') || f.includes('payment') || f.includes('cart'))
                tags.add('@checkout');
            if (f.includes('api/'))
                tags.add('@api');
            if (f.match(/\.(css|scss)$/))
                tags.add('@visual');
        }
        if (tags.size === 0)
            tags.add('@all');
    }
    return {
        tags: Array.from(tags),
        files: matchedFiles.length ? matchedFiles : diff.files,
        reason: `Mapped ${diff.files.length} changed files to ${Array.from(tags).join(', ')}`
    };
}
