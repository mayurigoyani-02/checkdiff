export interface ParsedTest {
    path: string;
    content: string;
    tags: string[];
    classes: string[];
    methods: string[];
    routes: string[];
}
export declare function extractTagsFromTestFile(content: string): string[];
export declare function parseTestFile(filePath: string): ParsedTest;
export declare function discoverAllTags(rootDir: string): {
    allTags: Set<string>;
    tests: ParsedTest[];
};
