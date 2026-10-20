export type DiffResult = {
    mode: 'git';
    files: string[];
    raw: string;
    base: string;
    head: string;
};
export declare function collectDiff(base?: string, head?: string): Promise<DiffResult>;
