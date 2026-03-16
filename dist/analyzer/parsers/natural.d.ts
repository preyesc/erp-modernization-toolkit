import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class NaturalParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parseClasses;
    private parseFunctions;
}
//# sourceMappingURL=natural.d.ts.map