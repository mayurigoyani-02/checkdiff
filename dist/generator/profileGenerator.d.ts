export type TestProfile = {
    tags: string[];
    testFiles: string[];
    command: string;
};
export declare function generateProfile(impact: {
    tags: string[];
    files: string[];
}, config: any): Promise<TestProfile>;
