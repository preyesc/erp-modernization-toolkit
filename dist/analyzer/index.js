import { CodeScanner } from './scanner.js';
import { DbDependencyDetector } from './db-detector.js';
import { MetricsCalculator } from './metrics.js';
import { GraphBuilder } from './graph-builder.js';
import { createDefaultRegistry } from './parsers/index.js';
const TOOLKIT_VERSION = '0.1.0';
export class Analyzer {
    constructor() {
        const registry = createDefaultRegistry();
        this.scanner = new CodeScanner(registry);
        this.dbDetector = new DbDependencyDetector(registry);
        this.metricsCalculator = new MetricsCalculator();
        this.graphBuilder = new GraphBuilder();
    }
    async analyze(projectPath) {
        // 1. Scan source code
        const modules = await this.scanner.scan(projectPath);
        const warnings = [...this.scanner.warnings];
        // 2. Detect DB dependencies
        const dbDependencies = await this.dbDetector.detect(modules);
        // Add unparsed query warnings
        for (const uq of dbDependencies.unparsedQueries) {
            warnings.push({
                type: 'unparsed_query',
                message: `Consulta no parseable: ${uq.reason}`,
                filePath: uq.sourceLocation.filePath,
            });
        }
        // 3. Build dependency graph
        const dependencyGraph = this.graphBuilder.build(modules, dbDependencies);
        // 4. Calculate metrics
        const metrics = this.metricsCalculator.calculate(modules, dependencyGraph);
        // 5. Build report
        const metadata = {
            projectPath,
            analyzedAt: new Date().toISOString(),
            toolkitVersion: TOOLKIT_VERSION,
            totalModules: modules.length,
            totalFiles: modules.length,
            supportedLanguages: this.scanner.getSupportedLanguages(),
        };
        return {
            metadata,
            modules,
            dependencyGraph,
            metrics,
            dbDependencies,
            warnings,
        };
    }
}
export { CodeScanner } from './scanner.js';
export { DbDependencyDetector } from './db-detector.js';
export { MetricsCalculator } from './metrics.js';
export { GraphBuilder } from './graph-builder.js';
export { createDefaultRegistry, ParserRegistry } from './parsers/index.js';
//# sourceMappingURL=index.js.map