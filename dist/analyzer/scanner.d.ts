import { ICodeScanner, IParserRegistry, ModuleInfo, AnalysisWarning } from '../models/types.js';
export declare class CodeScanner implements ICodeScanner {
    private registry;
    warnings: AnalysisWarning[];
    constructor(registry: IParserRegistry);
    scan(projectPath: string): Promise<ModuleInfo[]>;
    getSupportedLanguages(): string[];
    private collectFiles;
    private extractExtension;
}
//# sourceMappingURL=scanner.d.ts.map