export interface AIImpactResult {
    tags: string[];
    confidence: number;
    reason: string;
}
export declare function aiImpact(changedFiles: string[], diffContent: string, rootDir: string): Promise<AIImpactResult>;
