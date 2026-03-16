import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class NaturalParser {
    constructor() {
        this.languageName = 'Natural';
        this.fileExtensions = ['.nsp', '.nsn', '.nss'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bFIND\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bREAD\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bSTORE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
            { pattern: /\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
            { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/\bDEFINE\s+DATA\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [
            /\bDEFINE\s+SUBROUTINE\s+(\w+)/i,
            /\bDEFINE\s+PROGRAM\s+(\w+)/i,
            /\bDEFINE\s+SUBPROGRAM\s+(\w+)/i,
        ];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=natural.js.map