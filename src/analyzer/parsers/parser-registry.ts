import { IParserRegistry, ILanguageParser } from '../../models/types.js';

export class ParserRegistry implements IParserRegistry {
  private parsers: ILanguageParser[] = [];
  private extensionMap: Map<string, ILanguageParser> = new Map();

  register(parser: ILanguageParser): void {
    this.parsers.push(parser);
    for (const ext of parser.fileExtensions) {
      this.extensionMap.set(ext.toLowerCase(), parser);
    }
  }

  getParserForFile(filePath: string): ILanguageParser | null {
    const ext = this.extractExtension(filePath);
    return ext ? (this.extensionMap.get(ext.toLowerCase()) ?? null) : null;
  }

  getSupportedLanguages(): string[] {
    return [...new Set(this.parsers.map(p => p.languageName))];
  }

  getSupportedExtensions(): string[] {
    return [...this.extensionMap.keys()];
  }

  private extractExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) return null;
    return filePath.slice(lastDot);
  }
}
