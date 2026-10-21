export interface TestResult {
    success: boolean;
    output: string;
    command: string;
}
export declare function runTests(command: string, opts?: {
    verbose?: boolean;
}): Promise<TestResult>;
