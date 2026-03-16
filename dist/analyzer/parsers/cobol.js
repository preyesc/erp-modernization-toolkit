import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class CobolParser {
    constructor() {
        this.languageName = 'COBOL';
        this.fileExtensions = ['.cbl', '.cob', '.cpy'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bEXEC\s+SQL\s+SELECT\b.*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
            { pattern: /\bEXEC\s+SQL\s+INSERT\s+INTO\s+(\w+)/i, operation: 'write', queryType: 'inline_sql' },
            { pattern: /\bEXEC\s+SQL\s+UPDATE\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
            { pattern: /\bEXEC\s+SQL\s+DELETE\s+FROM\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
            { pattern: /\bREAD\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bWRITE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
            { pattern: /\bREWRITE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
            { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/(\w+)\s+DIVISION\b/i, /(\w+)\s+SECTION\b/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [/\bPERFORM\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        const unique = [...new Set(matches.map(m => m.name))];
        return unique.map(name => ({ name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=cobol.js.map