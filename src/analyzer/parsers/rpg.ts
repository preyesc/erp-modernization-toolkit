import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class RpgParser implements ILanguageParser {
  languageName = 'RPG';
  fileExtensions = ['.rpg', '.rpgle', '.sqlrpgle'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, [], functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bREAD\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bCHAIN\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bWRITE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bUPDATE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bEXEC\s+SQL\s+SELECT\b.*?\bFROM\s+(\w+)/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bEXEC\s+SQL\s+INSERT\s+INTO\s+(\w+)/i, operation: 'write', queryType: 'inline_sql' },
    ]);
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      /\bBEGSR\s+(\w+)/i,
      /\bDCL-PROC\s+(\w+)/i,
      /\bP\s+(\w+)\s+B/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
