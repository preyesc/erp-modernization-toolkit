import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class Progress4glParser implements ILanguageParser {
  languageName = 'Progress 4GL';
  fileExtensions = ['.p', '.w', '.i', '.cls'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const classes = this.parseClasses(content);
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, classes, functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bFIND\s+(?:FIRST|LAST)?\s*(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bFOR\s+EACH\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bCREATE\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bDELETE\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bBUFFER-COPY\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    const patterns = [/\bCLASS\s+(\w+)/i];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      /\bPROCEDURE\s+(\w+)/i,
      /\bFUNCTION\s+(\w+)/i,
      /\bMETHOD\s+(?:PUBLIC|PRIVATE|PROTECTED)?\s*(?:VOID|CHARACTER|INTEGER|LOGICAL|DECIMAL)?\s*(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
