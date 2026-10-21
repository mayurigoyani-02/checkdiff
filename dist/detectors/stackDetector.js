"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectStack = detectStack;
const fs_1 = __importDefault(require("fs"));
async function detectStack() {
    const has = (p) => fs_1.default.existsSync(p);
    if (has('next.config.js') || has('next.config.mjs'))
        return { type: 'web', framework: 'nextjs', testDir: 'e2e' };
    if (has('package.json')) {
        const pkg = JSON.parse(fs_1.default.readFileSync('package.json', 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@playwright/test'] || deps['playwright'])
            return { type: 'web', framework: 'playwright' };
        if (deps['react'])
            return { type: 'web', framework: 'react' };
        if (deps['vue'])
            return { type: 'web', framework: 'vue' };
        if (deps['express'])
            return { type: 'service', framework: 'express' };
    }
    if (has('requirements.txt') || has('pyproject.toml'))
        return { type: 'service', framework: 'python' };
    if (has('wp-config.php'))
        return { type: 'cms', framework: 'wordpress' };
    if (has('shopify.config.js'))
        return { type: 'ecommerce', framework: 'shopify' };
    return { type: 'static', framework: 'unknown' };
}
