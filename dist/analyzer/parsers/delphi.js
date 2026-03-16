import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';
export class DelphiParser {
    constructor() {
        this.languageName = 'Delphi';
        this.fileExtensions = ['.pas', '.dpr', '.dfm'];
    }
    parseFile(filePath, content) {
        const classes = this.parseClasses(content);
        const functions = this.parseFunctions(content);
        return createModuleInfo(filePath, this.languageName, content, classes, functions);
    }
    detectDbAccess(content, filePath) {
        const moduleName = path.basename(filePath, path.extname(filePath));
        return detectDbReferences(content, filePath, moduleName, [
            { pattern: /\bTQuery\b.*?\.SQL.*?['"].*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
            { pattern: /\bTTable\b.*?TableName\s*:?=\s*'(\w+)'/i, operation: 'read', queryType: 'table_reference' },
            { pattern: /\.SQL\.(?:Add|Text)\s*\(?\s*'.*?\bSELECT\b.*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
            { pattern: /\.SQL\.(?:Add|Text)\s*\(?\s*'.*?\bINSERT\s+INTO\s+(\w+)/i, operation: 'write', queryType: 'inline_sql' },
            { pattern: /\.SQL\.(?:Add|Text)\s*\(?\s*'.*?\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
            { pattern: /\.SQL\.(?:Add|Text)\s*\(?\s*'.*?\bDELETE\s+FROM\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
        ]);
    }
    parseClasses(content) {
        const patterns = [/\b(\w+)\s*=\s*class\b/i];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
    }
    parseFunctions(content) {
        const patterns = [
            /\bprocedure\s+(?:\w+\.)?(\w+)/i,
            /\bfunction\s+(?:\w+\.)?(\w+)/i,
        ];
        const matches = matchPatterns(content, patterns);
        return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
    }
}
//# sourceMappingURL=delphi.js.map