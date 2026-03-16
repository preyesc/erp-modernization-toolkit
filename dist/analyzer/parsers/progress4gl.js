import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class Progress4glParser {
    constructor() {
        this.languageName = 'Progress 4GL';
        this.fileExtensions = ['.p', '.w', '.i', '.cls'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bFIND\s+(?:FIRST|LAST)?\s*(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bFOR\s+EACH\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\bCREATE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
            { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
            { pattern: /\bBUFFER-COPY\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/\bCLASS\s+(\w+)/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [
            /\bPROCEDURE\s+(\w+)/i,
            /\bFUNCTION\s+(\w+)/i,
            /\bMETHOD\s+(?:PUBLIC|PRIVATE|PROTECTED)?\s*(?:VOID|CHARACTER|INTEGER|LOGICAL|DECIMAL)?\s*(\w+)/i,
        ];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=progress4gl.js.map