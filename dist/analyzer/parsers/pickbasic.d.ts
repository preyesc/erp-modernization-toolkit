import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class PickBasicParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parseFunctions;
}
//# sourceMappingURL=pickbasic.d.ts.map