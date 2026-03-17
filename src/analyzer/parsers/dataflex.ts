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
      // Find command: Find LT|LE|EQ|GE|GT {table} By ...
      // or: Find LT|LE|EQ|GE|GT {table.column}
      { pattern: /\bFind\s+(?:LT|LE|EQ|GE|GT)\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Constrained_Find: same syntax as Find but with constraints applied
      { pattern: /\bConstrained_Find\s+(?:LT|LE|EQ|GE|GT)\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // VFind: variable-based find
      { pattern: /\bVFind\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Relate: loads parent records related to a child table
      { pattern: /\bRelate\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Clear / Constrained_Clear: clears the record buffer for a table
      { pattern: /\bClear\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      { pattern: /\bConstrained_Clear\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Save / SaveRecord: writes a record to the database table
      { pattern: /\bSaveRecord\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      { pattern: /\bSave\s+(\w+)/i, operation: 'write', queryType: 'table_reference' },
      // Delete: removes a record from a database table
      { pattern: /\bDelete\s+(\w+)/i, operation: 'modify', queryType: 'table_reference' },
      // Reread: re-reads and locks the current record
      { pattern: /\bReread\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Lock: locks a record for exclusive access
      { pattern: /\bLock\b/i, operation: 'modify', queryType: 'table_reference' },
      // Open: opens a database table for access
      { pattern: /\bOpen\s+(\w+)/i, operation: 'read', queryType: 'table_reference' },
      // Embedded SQL via cSQLExecutor (DataFlex 2023+)
      { pattern: /\bSQLExecDirect\b.*?@SQL"([^"]*?)"/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bSQLPrepare\b.*?@SQL"([^"]*?)"/i, operation: 'read', queryType: 'inline_sql' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    // DataFlex class: Class {name} Is a {parent}
    // DataFlex object: Object {name} Is a {class}
    const patterns = [
      /\bClass\s+(\w+)\s+Is\s+a\b/i,
      /\bObject\s+(\w+)\s+Is\s+a\b/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    // Procedure {name} [Global] [params...]
    // Function {name} [Global] [params...] Returns {type}
    const patterns = [
      /\bProcedure\s+(\w+)/i,
      /\bFunction\s+(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
