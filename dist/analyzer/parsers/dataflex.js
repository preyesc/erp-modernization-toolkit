import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class DataFlexParser {
    constructor() {
        this.languageName = 'DataFlex';
        this.fileExtensions = ['.src', '.pkg', '.wo', '.dg', '.rv', '.sl', '.vw'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bFind\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bRelate\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bClear\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
            { pattern: /\bSave(?:Record)?\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
            { pattern: /\bDelete\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
            { pattern: /\bRead\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/\bObject\s+(\w+)/i, /\bClass\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [/\bProcedure\s+(\w+)/i, /\bFunction\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=dataflex.js.map