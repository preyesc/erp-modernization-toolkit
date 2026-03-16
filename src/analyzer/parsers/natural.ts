import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class NaturalParser implements ILanguageParser {
  languageName = 'Natural';
  fileExtensions = ['.nsp', '.nsn', '.nss'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const classes = this.parseClasses(content);
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, classes, functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bFIND\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bREAD\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bSTORE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    const patterns = [/\bDEFINE\s+DATA\s+(\w+)/i];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      /\bDEFINE\s+SUBROUTINE\s+(\w+)/i,
      /\bDEFINE\s+PROGRAM\s+(\w+)/i,
      /\bDEFINE\s+SUBPROGRAM\s+(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
