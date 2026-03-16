import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class PlsqlParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parsePackages;
    private parseFunctions;
}
//# sourceMappingURL=plsql.d.ts.map