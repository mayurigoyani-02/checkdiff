import type { TestProfile } from '../generator/profileGenerator.js';
export declare function runPlaywright(profile: TestProfile, config: any): Promise<{
    passed: number;
    failed: number;
    summary: string;
}>;
