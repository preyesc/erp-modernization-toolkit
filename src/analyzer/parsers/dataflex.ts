import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class DataFlexParser implements ILanguageParser {
  languageName = 'DataFlex';
  fileExtensions = ['.src', '.pkg', '.wo', '.dg', '.rv', '.sl', '.vw'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const classes = this.parseClasses(content);
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, classes, functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      { pattern: /\bFind\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bRelate\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bClear\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bSave(?:Record)?\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bDelete\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      { pattern: /\bRead\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    const patterns = [/\bObject\s+(\w+)/i, /\bClass\s+(\w+)/i];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [/\bProcedure\s+(\w+)/i, /\bFunction\s+(\w+)/i];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
