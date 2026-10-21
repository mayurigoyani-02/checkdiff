export interface DiffResult {
    files: string[];
    diffContent: string;
    base: string;
    head: string;
}
export declare function collectDiff(opts: {
    base: string;
    head: string;
    verbose?: boolean;
}): Promise<DiffResult>;
