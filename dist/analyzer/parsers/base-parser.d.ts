import { ModuleInfo, ClassInfo, FunctionInfo, DbReference } from '../../models/types.js';
export interface PatternMatch {
    name: string;
    line: number;
}
export declare function createModuleInfo(filePath: string, language: string, content: string, classes: ClassInfo[], functions: FunctionInfo[]): ModuleInfo;
export declare function matchPatterns(content: string, patterns: RegExp[]): PatternMatch[];
export declare function detectDbReferences(content: string, filePath: string, moduleName: string, patterns: {
    pattern: RegExp;
    operation: 'read' | 'write' | 'modify';
    queryType: DbReference['queryType'];
}[]): DbReference[];
//# sourceMappingURL=base-parser.d.ts.map