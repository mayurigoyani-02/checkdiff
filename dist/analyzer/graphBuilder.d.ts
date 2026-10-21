export declare function findAffectedTests(changedFiles: string[], rootDir: string): Promise<{
    affected: any[];
    allTags: Set<string>;
    tests: import("./testParser").ParsedTest[];
    reason: string;
    changedKeywords?: undefined;
} | {
    affected: import("./testParser").ParsedTest[];
    allTags: Set<string>;
    tests: import("./testParser").ParsedTest[];
    reason: string;
    changedKeywords: string[];
}>;
export declare function buildGraph(rootDir: string): Promise<{
    fileToImports: Map<any, any>;
    importToFiles: Map<any, any>;
}>;
