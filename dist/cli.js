#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/cli.ts
const commander_1 = require("commander");
const index_1 = require("./index");
const program = new commander_1.Command();
program
    .name('checkdiff')
    .description('AI-powered E2E test impact analysis - run only tests affected by your changes')
    .version('2.0.0');
program
    .command('run')
    .description('Run impacted E2E tests based on git diff')
    .option('--base <branch>', 'Base branch to compare against', 'origin/main')
    .option('--head <branch>', 'Head to compare', 'HEAD')
    .option('--ai', 'Enable AI semantic analysis (requires CHECKDIFF_AI_KEY)', false)
    .option('--dry', 'Dry run - show impact without running tests', false)
    .option('--verbose', 'Verbose logging', false)
    .option('--all', 'Force run all tests (bypass impact analysis)', false)
    .action(async (opts) => {
    try {
        if (opts.all) {
            console.log('▶ Running: npx playwright test (forced --all)\n');
            const { runTests } = await Promise.resolve().then(() => __importStar(require('./runner/testRunner')));
            await runTests('npx playwright test', { verbose: opts.verbose });
            return;
        }
        const result = await (0, index_1.checkdiff)({
            base: opts.base,
            head: opts.head,
            ai: opts.ai,
            dry: opts.dry,
            verbose: opts.verbose
        });
        if (result.testResult && !result.testResult.success) {
            process.exit(1);
        }
    }
    catch (err) {
        console.error('\n❌ CheckDiff failed:', err.message);
        if (opts.verbose)
            console.error(err.stack);
        process.exit(1);
    }
});
program
    .command('analyze')
    .description('Analyze impact without running tests (alias for run --dry)')
    .option('--base <branch>', 'Base branch', 'origin/main')
    .option('--ai', 'Enable AI', false)
    .option('--verbose', 'Verbose', false)
    .action(async (opts) => {
    await (0, index_1.checkdiff)({ base: opts.base, ai: opts.ai, dry: true, verbose: opts.verbose });
});
program
    .command('graph')
    .description('Show dependency graph for debugging')
    .option('--verbose', 'Verbose', false)
    .action(async (opts) => {
    const { buildGraph } = await Promise.resolve().then(() => __importStar(require('./analyzer/graphBuilder')));
    const graph = await buildGraph(process.cwd());
    console.log(`Graph: ${graph.fileToImports.size} files`);
    if (opts.verbose) {
        for (const [file, imports] of graph.fileToImports.entries()) {
            if (imports.size > 0) {
                console.log(`\n${file}:`);
                imports.forEach(i => console.log(`  -> ${i}`));
            }
        }
    }
});
// Handle: npx checkdiff --base HEAD (without 'run' command) - backwards compat
if (process.argv.length > 2 && !['run', 'analyze', 'graph'].includes(process.argv[2])) {
    // Convert `npx checkdiff --base HEAD` to `npx checkdiff run --base HEAD`
    const args = process.argv.slice(2);
    program.parse(['node', 'cli.ts', 'run', ...args]);
}
else {
    program.parse();
}
