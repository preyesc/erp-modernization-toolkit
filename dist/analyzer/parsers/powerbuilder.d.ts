import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class PowerBuilderParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parseClasses;
    private parseFunctions;
}
//# sourceMappingURL=powerbuilder.d.ts.map