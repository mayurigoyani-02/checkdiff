import type { DiffResult } from '../collectors/gitCollector.js';
type AnyDiff = DiffResult | {
    mode: 'black-box';
    url: string;
    files: string[];
    raw?: string;
};
interface MappingConfig {
    [glob: string]: string[];
}
interface ImpactResult {
    tags: string[];
    files: string[];
    reason: string;
    command?: string;
    stack?: any;
}
export declare function mapImpact(diff: AnyDiff, mapping: MappingConfig, stack?: any): ImpactResult;
export {};
