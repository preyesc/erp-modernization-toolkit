import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class FoxproParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parseClasses;
    private parseFunctions;
}
//# sourceMappingURL=foxpro.d.ts.map