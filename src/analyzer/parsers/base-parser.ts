import { ModuleInfo, ClassInfo, FunctionInfo, DbReference } from '../../models/types.js';
import * as path from 'path';

export interface PatternMatch {
  name: string;
  line: number;
}

export function createModuleInfo(
  filePath: string,
  language: string,
  content: string,
  classes: ClassInfo[],
  functions: FunctionInfo[]
): ModuleInfo {
  const name = path.basename(filePath, path.extname(filePath));
  return {
    name,
    path: filePath,
    language,
    classes,
    functions,
    lineCount: content.split('\n').length,
  };
}

export function matchPatterns(content: string, patterns: RegExp[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      const match = lines[i].match(pattern);
      if (match && match[1]) {
        results.push({ name: match[1].trim(), line: i + 1 });
      }
    }
  }
  return results;
}

export function detectDbReferences(
  content: string,
  filePath: string,
  moduleName: string,
  patterns: { pattern: RegExp; operation: 'read' | 'write' | 'modify'; queryType: DbReference['queryType'] }[]
): DbReference[] {
  const refs: DbReference[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, operation, queryType } of patterns) {
      const match = line.match(pattern);
      if (match) {
        const tableName = match[1]?.trim() || 'unknown';
        refs.push({
          moduleName,
          tableName,
          operation,
          sourceLocation: { filePath, lineNumber: i + 1 },
          queryType,
        });
      }
    }
  }
  return refs;
}
