"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTagsFromTestFile = extractTagsFromTestFile;
exports.parseTestFile = parseTestFile;
exports.discoverAllTags = discoverAllTags;
// src/analyzer/testParser.ts - No hardcoding, extracts from class/method/test names
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const STOP_WORDS = new Set([
    'test', 'spec', 'should', 'when', 'with', 'from', 'service', 'controller', 'module',
    'describe', 'before', 'after', 'setup', 'teardown', 'mock', 'stub', 'fake', 'util',
    'helper', 'index', 'app', 'api', 'e2e', 'src', 'lib', 'component', 'page', 'data'
]);
function splitIdentifier(name) {
    // PaymentController -> payment, controller
    // create-payment -> create, payment
    // createPayment -> create, payment
    return name
        .split(/(?=[A-Z])|[-_\s]+/)
        .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}
function extractTagsFromTestFile(content) {
    const tags = new Set();
    // 1. Explicit @tags: @payment @critical @auth
    const explicit = content.match(/@[\w-]+/g);
    if (explicit)
        explicit.forEach(t => tags.add(t.toLowerCase()));
    // 2. From describe/test titles: describe('Payment flow') -> @payment, @flow
    const describeRegex = /(?:describe|test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = describeRegex.exec(content)) !== null) {
        splitIdentifier(m[1]).forEach(w => tags.add(`@${w}`));
    }
    // 3. From class names: class PaymentService -> @payment
    const classRegex = /class\s+(\w+)/g;
    while ((m = classRegex.exec(content)) !== null) {
        splitIdentifier(m[1]).forEach(w => tags.add(`@${w}`));
    }
    // 4. From method/function names: function createPayment -> @payment, @create
    const methodRegex = /(?:function|const\s+\w+\s*=\s*|async\s+)?(\w+)\s*\(/g;
    while ((m = methodRegex.exec(content)) !== null) {
        if (m[1].length > 3)
            splitIdentifier(m[1]).forEach(w => tags.add(`@${w}`));
    }
    // 5. From API routes: /api/payment/checkout -> @payment, @checkout
    const routeRegex = /\/api\/([\w\/-]+)/g;
    while ((m = routeRegex.exec(content)) !== null) {
        m[1].split('/').forEach(part => splitIdentifier(part).forEach(w => tags.add(`@${w}`)));
    }
    return [...tags];
}
function parseTestFile(filePath) {
    let content = '';
    try {
        content = fs_1.default.readFileSync(filePath, 'utf8');
    }
    catch {
        content = '';
    }
    const tags = extractTagsFromTestFile(content);
    const classes = [...content.matchAll(/class\s+(\w+)/g)].map(m => m[1]);
    const methods = [...content.matchAll(/(?:function|async)\s+(\w+)/g)].map(m => m[1]);
    const routes = [...content.matchAll(/\/api\/([\w\/-]+)/g)].map(m => m[1]);
    return { path: filePath, content, tags, classes, methods, routes };
}
function discoverAllTags(rootDir) {
    const e2eDir = path_1.default.join(rootDir, 'e2e');
    const tests = [];
    const allTags = new Set();
    if (!fs_1.default.existsSync(e2eDir))
        return { allTags, tests };
    const files = fs_1.default.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js') || f.endsWith('.test.ts'));
    for (const file of files) {
        const parsed = parseTestFile(path_1.default.join(e2eDir, file));
        tests.push(parsed);
        parsed.tags.forEach(t => allTags.add(t));
    }
    return { allTags, tests };
}
