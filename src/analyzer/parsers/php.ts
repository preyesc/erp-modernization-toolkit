import { ILanguageParser, ModuleInfo, DbReference, ClassInfo, FunctionInfo } from '../../models/types.js';
import { createModuleInfo, matchPatterns, detectDbReferences } from './base-parser.js';
import * as path from 'path';

export class PhpParser implements ILanguageParser {
  languageName = 'PHP';
  fileExtensions = ['.php', '.phtml', '.php5', '.php7', '.inc'];

  parseFile(filePath: string, content: string): ModuleInfo {
    const classes = this.parseClasses(content);
    const functions = this.parseFunctions(content);
    return createModuleInfo(filePath, this.languageName, content, classes, functions);
  }

  detectDbAccess(content: string, filePath: string): DbReference[] {
    const moduleName = path.basename(filePath, path.extname(filePath));
    return detectDbReferences(content, filePath, moduleName, [
      // Raw SQL queries via mysql_query, mysqli_query, pg_query, oci_execute
      { pattern: /\bmysql_query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bmysqli_query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bmysqli_real_query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bpg_query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bpg_query_params\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\boci_execute\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\boci_parse\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bsqlsrv_query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      // PDO prepared statements and direct execution
      { pattern: /->prepare\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /->exec\s*\(/i, operation: 'modify', queryType: 'inline_sql' },
      { pattern: /->query\s*\(/i, operation: 'read', queryType: 'inline_sql' },
      // SQL keywords embedded in strings
      { pattern: /\bSELECT\s+.+?\bFROM\s+[`"']?(\w+)/i, operation: 'read', queryType: 'inline_sql' },
      { pattern: /\bINSERT\s+INTO\s+[`"']?(\w+)/i, operation: 'write', queryType: 'inline_sql' },
      { pattern: /\bUPDATE\s+[`"']?(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
      { pattern: /\bDELETE\s+FROM\s+[`"']?(\w+)/i, operation: 'modify', queryType: 'inline_sql' },
      // ORM / framework patterns
      // Laravel Eloquent: DB::table('name'), Model::where(...)
      { pattern: /DB::table\s*\(\s*['"](\w+)['"]\s*\)/i, operation: 'read', queryType: 'table_reference' },
      // Doctrine DQL / QueryBuilder: ->from('Table', ...)
      { pattern: /->from\s*\(\s*['"](\w+)['"]/i, operation: 'read', queryType: 'table_reference' },
      // Stored procedures
      { pattern: /\bCALL\s+[`"']?(\w+)/i, operation: 'read', queryType: 'stored_procedure' },
    ]);
  }

  private parseClasses(content: string): ClassInfo[] {
    const patterns = [
      // class Name extends Parent implements Interface
      /\bclass\s+(\w+)/i,
      // interface Name
      /\binterface\s+(\w+)/i,
      // trait Name
      /\btrait\s+(\w+)/i,
      // enum Name (PHP 8.1+)
      /\benum\s+(\w+)/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, methods: [], dependencies: [] }));
  }

  private parseFunctions(content: string): FunctionInfo[] {
    const patterns = [
      // function name(...)
      /\bfunction\s+(\w+)\s*\(/i,
    ];
    const matches = matchPatterns(content, patterns);
    return matches.map(m => ({ name: m.name, parameters: [], dependencies: [] }));
  }
}
