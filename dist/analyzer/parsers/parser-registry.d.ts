import { IParserRegistry, ILanguageParser } from '../../models/types.js';
export declare class ParserRegistry implements IParserRegistry {
    private parsers;
    private extensionMap;
    register(parser: ILanguageParser): void;
    getParserForFile(filePath: string): ILanguageParser | null;
    getSupportedLanguages(): string[];
    getSupportedExtensions(): string[];
    private extractExtension;
}
//# sourceMappingURL=parser-registry.d.ts.map