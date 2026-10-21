import { DiffResult } from './collectors/gitCollector';
import { ImpactResult } from './mapper/impactMapper';
import { TestResult } from './runner/testRunner';
export interface CheckDiffOptions {
    base?: string;
    head?: string;
    ai?: boolean;
    dry?: boolean;
    verbose?: boolean;
}
export interface CheckDiffResult {
    diff: DiffResult;
    impact: ImpactResult;
    testResult?: TestResult;
}
export declare function checkdiff(options?: CheckDiffOptions): Promise<CheckDiffResult>;
export { collectDiff } from './collectors/gitCollector';
export { mapImpact } from './mapper/impactMapper';
export { runTests } from './runner/testRunner';
