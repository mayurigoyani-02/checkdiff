"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
// src/runner/testRunner.ts
const child_process_1 = require("child_process");
async function runTests(command, opts = {}) {
    if (!command || command.includes('echo "')) {
        return { success: true, output: command, command };
    }
    try {
        if (opts.verbose)
            console.log(`  exec: ${command}`);
        const output = (0, child_process_1.execSync)(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd()
        });
        return { success: true, output, command };
    }
    catch (e) {
        const output = e.stdout?.toString() || e.stderr?.toString() || e.message;
        return { success: false, output, command };
    }
}
