import { ILanguageParser, ModuleInfo, DbReference } from '../../models/types.js';
export declare class Progress4glParser implements ILanguageParser {
    languageName: string;
    fileExtensions: string[];
    parseFile(filePath: string, content: string): ModuleInfo;
    detectDbAccess(content: string, filePath: string): DbReference[];
    private parseClasses;
    private parseFunctions;
}
//# sourceMappingURL=progress4gl.d.ts.map