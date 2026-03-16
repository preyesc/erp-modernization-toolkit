import * as fs from 'fs';
import * as path from 'path';
import { ICodeScanner, IParserRegistry, ModuleInfo, AnalysisWarning } from '../models/types.js';
import { InvalidPathError, NoSourceFilesError } from '../models/errors.js';

export class CodeScanner implements ICodeScanner {
  public warnings: AnalysisWarning[] = [];

  constructor(private registry: IParserRegistry) {}

  async scan(projectPath: string): Promise<ModuleInfo[]> {
    if (!fs.existsSync(projectPath)) {
      throw new InvalidPathError(projectPath);
    }

    this.warnings = [];
    const files = this.collectFiles(projectPath);

    if (files.length === 0) {
      throw new NoSourceFilesError(projectPath);
    }

    const supportedExtensions = new Set(this.registry.getSupportedExtensions());
    const modules: ModuleInfo[] = [];
    let hasSupportedFiles = false;

    for (const filePath of files) {
      const ext = this.extractExtension(filePath);
      const parser = this.registry.getParserForFile(filePath);

      if (parser) {
        hasSupportedFiles = true;
        const content = fs.readFileSync(filePath, 'utf-8');
        const moduleInfo = parser.parseFile(filePath, content);
        modules.push(moduleInfo);
      } else if (ext && !supportedExtensions.has(ext.toLowerCase())) {
        this.warnings.push({
          type: 'unsupported_language',
          message: `Archivo en lenguaje no soportado omitido: ${filePath}`,
          filePath,
        });
      }
    }

    if (!hasSupportedFiles) {
      throw new NoSourceFilesError(projectPath);
    }

    return modules;
  }

  getSupportedLanguages(): string[] {
    return this.registry.getSupportedLanguages();
  }

  private collectFiles(dirPath: string): string[] {
    const results: string[] = [];
    const stat = fs.statSync(dirPath);

    if (stat.isFile()) {
      results.push(dirPath);
      return results;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          results.push(...this.collectFiles(fullPath));
        }
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private extractExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) return null;
    return filePath.slice(lastDot);
  }
}
