export class ParserRegistry {
    constructor() {
        this.parsers = [];
        this.extensionMap = new Map();
    }
    register(parser) {
        this.parsers.push(parser);
        for (const ext of parser.fileExtensions) {
            this.extensionMap.set(ext.toLowerCase(), parser);
        }
    }
    getParserForFile(filePath) {
        const ext = this.extractExtension(filePath);
        return ext ? (this.extensionMap.get(ext.toLowerCase()) ?? null) : null;
    }
    getSupportedLanguages() {
        return [...new Set(this.parsers.map(p => p.languageName))];
    }
    getSupportedExtensions() {
        return [...this.extensionMap.keys()];
    }
    extractExtension(filePath) {
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1 || lastDot === filePath.length - 1)
            return null;
        return filePath.slice(lastDot);
    }
}
//# sourceMappingURL=parser-registry.js.map