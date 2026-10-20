export type Stack = {
    type: string;
    framework: string;
    testDir?: string;
};
export declare function detectStack(): Promise<Stack>;
