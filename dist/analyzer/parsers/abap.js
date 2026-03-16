import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class AbapParser {
    constructor() {
        this.languageName = 'ABAP';
        this.fileExtensions = ['.abap', '.fugr', '.prog', '.clas'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bSELECT\b.*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
            { pattern: /\bINSERT\s+INTO\s+(\w+)/i, operation: 'write', queryType: 'inline_sql' },
            { pattern: /\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
            { pattern: /\bDELETE\s+FROM\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
            { pattern: /\bMODIFY\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/\bCLASS\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [/\bMETHOD\s+(\w+)/i, /\bFORM\s+(\w+)/i, /\bFUNCTION\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=abap.js.map