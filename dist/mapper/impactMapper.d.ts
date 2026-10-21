export interface ImpactResult {
    tags: string[];
    files: string[];
    reason: string;
    command: string;
    affectedTests?: string[];
}
export declare function mapImpact(diff: any, opts: {
    rootDir: string;
    ai?: boolean;
    verbose?: boolean;
}): Promise<ImpactResult>;
