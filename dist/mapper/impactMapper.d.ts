export type Impact = {
    tags: string[];
    files: string[];
    reason: string;
};
export declare function mapImpact(diff: any, config: any, stack: any): Promise<Impact>;
