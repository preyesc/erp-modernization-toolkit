import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class FoxproParser implements ILanguageParser {
  languageName = 'Visual FoxPro';
  fileExtensions = ['.prg', '.scx', '.vcx', '.frx'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const classes = this.parseClasses(content);
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, classes, functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bSELECT\b.*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bINSERT\s+INTO\s+(\w+)/i, operation: 'write', queryType: 'inline_sql' },
      { pattern: /\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
      { pattern: /\bDELETE\s+FROM\s+(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
      { pattern: /\bUSE\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bSCAN\b/i, operation: 'read', queryType: 'table_reference' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    const patterns = [/\bDEFINE\s+CLASS\s+(\w+)/i];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      /\bPROCEDURE\s+(\w+)/i,
      /\bFUNCTION\s+(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
