import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class PickBasicParser implements ILanguageParser {
  languageName = 'Pick/BASIC';
  fileExtensions = ['.bp', '.b'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, [], functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bREAD\s+\w+\s+FROM\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bWRITE\s+\w+\s+(?:ON|TO)\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bMATREAD\s+\w+\s+FROM\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bOPEN\s+['"]?(\w+)['"]?/i, operation: 'read', queryType: 'table_reference' },
    ]);
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      /\bSUBROUTINE\s+(\w+)/i,
      /\bFUNCTION\s+(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
