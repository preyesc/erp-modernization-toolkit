import { IAnalyzer, AnalysisReport } from '../models/types.js';
export declare class Analyzer implements IAnalyzer {
    private scanner;
    private dbDetector;
    private metricsCalculator;
    private graphBuilder;
    constructor();
    analyze(projectPath: string): Promise<AnalysisReport>;
}
export { CodeScanner } from './scanner.js';
export { DbDependencyDetector } from './db-detector.js';
export { MetricsCalculator } from './metrics.js';
export { GraphBuilder } from './graph-builder.js';
export { createDefaultRegistry, ParserRegistry } from './parsers/index.js';
//# sourceMappingURL=index.d.ts.map