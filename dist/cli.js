#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { collectDiff } from './collectors/gitCollector.js';
import { detectStack } from './detectors/stackDetector.js';
import { mapImpact } from './mapper/impactMapper.js';
import { generateProfile } from './generator/profileGenerator.js';
import { runPlaywright } from './runners/playwrightRunner.js';
import { loadConfig } from './utils/config.js';
const program = new Command();
program
    .name('checkdiff')
    .description('Universal check-in aware E2E testing for any website/service')
    .version('1.0.0');
program.command('init')
    .description('Initialize checkdiff config')
    .action(async () => {
    console.log(pc.green('Creating checkdiff.config.js'));
    const { copyFile } = await import('fs/promises');
    try {
        await copyFile('checkdiff.config.example.js', 'checkdiff.config.js');
    }
    catch { }
    console.log(pc.cyan('Edit checkdiff.config.js to customize mappings'));
});
program.command('run')
    .description('Run diff-aware E2E tests')
    .option('--base <branch>', 'Base branch/sha', 'main')
    .option('--head <branch>', 'Head branch/sha', 'HEAD')
    .option('--url <url>', 'Black-box mode: test live URL')
    .option('--dry', 'Dry run: show what would be tested')
    .action(async (opts) => {
    const spinner = ora('Detecting project stack...').start();
    const config = await loadConfig();
    const stack = await detectStack();
    spinner.succeed(`Detected stack: ${pc.bold(stack.type)} (${stack.framework})`);
    let diff;
    if (opts.url) {
        spinner.start('Running black-box crawl...');
        // For MVP, black-box delegates to visual/API snapshot diff
        diff = { mode: 'black-box', url: opts.url, files: [], tags: ['@all'] };
        spinner.succeed(`Black-box target: ${opts.url}`);
    }
    else {
        spinner.start(`Collecting diff ${opts.base}...${opts.head}`);
        diff = await collectDiff(opts.base, opts.head);
        spinner.succeed(`Found ${diff.files.length} changed files`);
        console.log(pc.dim(diff.files.slice(0, 10).join(', ')));
    }
    const impact = await mapImpact(diff, config, stack);
    console.log(pc.yellow(`
Impact: ${impact.tags.join(', ')}`));
    console.log(pc.dim(`Reason: ${impact.reason}`));
    const profile = await generateProfile(impact, config);
    console.log(pc.green(`
Test Profile: ${profile.testFiles.length} files, ${profile.tags.join(', ')}`));
    if (opts.dry) {
        console.log(profile);
        return;
    }
    const results = await runPlaywright(profile, config);
    console.log(results.summary);
    process.exit(results.failed > 0 ? 1 : 0);
});
program.parse();
