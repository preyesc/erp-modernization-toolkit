import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class PlsqlParser {
    constructor() {
        this.languageName = 'PL/SQL';
        this.fileExtensions = ['.sql', '.pls', '.plb', '.pck'];
    }
    parseFile(filePath, content) {
        const classes = this.parsePackages(content);
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
            { pattern: /\bMERGE\s+INTO\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
        ]);
    }
    parsePackages(content) {
        const patterns = [/\bPACKAGE\s+(?:BODY\s+)?(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [
            /\bPROCEDURE\s+(\w+)/i,
            /\bFUNCTION\s+(\w+)/i,
            /\bTRIGGER\s+(\w+)/i,
        ];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=plsql.js.map