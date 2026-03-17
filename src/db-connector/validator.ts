import type {
  ConnectionConfig,
  DbDependencyMap,
  IDbAdapter,
  ITableValidator,
  SourceLocation,
  TableValidationResult,
  ValidationReport,
  ValidationSummary,
} from '../models/types.js';
import { findSimilar } from './levenshtein.js';

const TOOLKIT_VERSION = '0.1.0';

/**
 * Compares {@link DbDependencyMap} table references from static analysis
 * against the tables that actually exist in a live database.
 *
 * Produces a {@link ValidationReport} classifying each unique table as
 * `'found'` or `'not_found'`, with fuzzy-match suggestions for missing tables.
 */
export class TableValidator implements ITableValidator {
  constructor(
    private readonly adapter: IDbAdapter,
    private readonly config: ConnectionConfig,
  ) {}

  async validate(dbDeps: DbDependencyMap, schemaFilter?: string): Promise<ValidationReport> {
    const dbTableNames = await this.adapter.getTableNames(schemaFilter);
    const dbTableSet = new Set(dbTableNames.map((t) => t.toLowerCase()));

    // Group references by table name (case-insensitive key, preserving original)
    const tableRefMap = new Map<string, { originalName: string; sourceRefs: SourceLocation[] }>();
    for (const ref of dbDeps.references) {
      const key = ref.tableName.toLowerCase();
      let entry = tableRefMap.get(key);
      if (!entry) {
        entry = { originalName: ref.tableName, sourceRefs: [] };
        tableRefMap.set(key, entry);
      }
      entry.sourceRefs.push(ref.sourceLocation);
    }

    const schemaName = schemaFilter ?? this.defaultSchemaForType();

    const results: TableValidationResult[] = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (const [key, { originalName, sourceRefs }] of tableRefMap) {
      if (dbTableSet.has(key)) {
        foundCount++;
        results.push({
          tableName: originalName,
          status: 'found',
          schemaLocation: `${schemaName}.${originalName}`,
          sourceReferences: sourceRefs,
        });
      } else {
        notFoundCount++;
        const suggestions = findSimilar(originalName, dbTableNames);
        results.push({
          tableName: originalName,
          status: 'not_found',
          sourceReferences: sourceRefs,
          suggestions,
        });
      }
    }

    const summary: ValidationSummary = {
      totalReferences: dbDeps.references.length,
      foundCount,
      notFoundCount,
    };

    return {
      metadata: {
        validatedAt: new Date().toISOString(),
        databaseType: this.config.databaseType,
        databaseName: this.config.databaseName,
        toolkitVersion: TOOLKIT_VERSION,
      },
      results,
      summary,
    };
  }

  /**
   * Returns a sensible default schema name based on the database type
   * when no explicit schema filter is provided.
   */
  private defaultSchemaForType(): string {
    switch (this.config.databaseType) {
      case 'postgresql':
        return 'public';
      case 'mssql':
        return 'dbo';
      case 'mysql':
        return this.config.databaseName;
      case 'oracle':
      case 'db2':
        return this.config.username.toUpperCase();
      default:
        return 'public';
    }
  }
}
