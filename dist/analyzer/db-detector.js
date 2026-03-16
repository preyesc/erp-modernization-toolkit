import * as fs from 'fs';
export class DbDependencyDetector {
    constructor(registry) {
        this.registry = registry;
        this.unparsedQueries = [];
    }
    async detect(modules) {
        const references = [];
        this.unparsedQueries = [];
        for (const mod of modules) {
            const parser = this.registry.getParserForFile(mod.path);
            if (!parser)
                continue;
            let content;
            try {
                content = fs.readFileSync(mod.path, 'utf-8');
            }
            catch {
                continue;
            }
            const dbRefs = parser.detectDbAccess(content, mod.path);
            references.push(...dbRefs);
            // Detect unparsed SQL queries (complex multi-line or dynamic SQL)
            const unparsed = this.detectUnparsedQueries(content, mod.path);
            this.unparsedQueries.push(...unparsed);
        }
        return {
            references,
            unparsedQueries: this.unparsedQueries,
        };
    }
    detectUnparsedQueries(content, filePath) {
        const unparsed = [];
        const lines = content.split('\n');
        // Detect dynamic SQL patterns that can't be statically analyzed
        const dynamicPatterns = [
            /\bEXECUTE\s+IMMEDIATE\b/i,
            /\bsp_executesql\b/i,
            /\bEXEC\s*\(/i,
            /\+\s*['"].*?SELECT\b/i,
            /\bPREPARE\s+\w+\s+FROM\b/i,
        ];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of dynamicPatterns) {
                if (pattern.test(line)) {
                    unparsed.push({
                        rawQuery: line.trim().slice(0, 200),
                        sourceLocation: { filePath, lineNumber: i + 1 },
                        reason: 'Dynamic SQL - cannot determine table references statically',
                    });
                    break;
                }
            }
        }
        return unparsed;
    }
}
//# sourceMappingURL=db-detector.js.map