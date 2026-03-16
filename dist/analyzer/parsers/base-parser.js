import * as path from 'path';
export function createModuleInfo(filePath, language, content, classes, functions) {
    const name = path.basename(filePath, path.extname(filePath));
    return {
        name,
        path: filePath,
        language,
        classes,
        functions,
        lineCount: content.split('\n').length,
    };
}
export function matchPatterns(content, patterns) {
    const results = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        for (const pattern of patterns) {
            const match = lines[i].match(pattern);
            if (match && match[1]) {
                results.push({ name: match[1].trim(), line: i + 1 });
            }
        }
    }
    return results;
}
export function detectDbReferences(content, filePath, moduleName, patterns) {
    const refs = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, operation, queryType } of patterns) {
            const match = line.match(pattern);
            if (match) {
                const tableName = match[1]?.trim() || 'unknown';
                refs.push({
                    moduleName,
                    tableName,
                    operation,
                    sourceLocation: { filePath, lineNumber: i + 1 },
                    queryType,
                });
            }
        }
    }
    return refs;
}
//# sourceMappingURL=base-parser.js.map