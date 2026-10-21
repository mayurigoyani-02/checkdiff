export interface DiffResult {
    mode: 'git';
    files: string[];
    raw: string;
    base: string;
    head: string;
    root: string;
}
export declare function collectDiff(base?: string, head?: string): Promise<DiffResult>;
export type BlackBoxResult = {
    mode: 'black-box';
    url: string;
    files: string[];
    raw?: string;
};
export type AnyDiffResult = DiffResult | BlackBoxResult;
