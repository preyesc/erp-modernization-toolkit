import type {
  IDbAdapter,
  ConnectionConfig,
  TableSchema,
  ColumnSchema,
  PrimaryKeyInfo,
  ForeignKeyInfo,
  DatabaseType,
} from '../../models/types.js';
import { ConnectionError, ConnectionLostError, IntrospectionError, TableNotFoundError } from '../../models/errors.js';

const CONNECTION_TIMEOUT_MS = 30_000;

export interface RawColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface RawPkRow {
  constraint_name: string;
  column_name: string;
}

export interface RawFkRow {
  constraint_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
}

/**
 * Base adapter providing shared connection lifecycle, timeout logic,
 * and error wrapping. Subclasses supply database-specific SQL and
 * type normalisation.
 */
export abstract class BaseAdapter implements IDbAdapter {
  protected _connected = false;
  protected _config: ConnectionConfig | null = null;

  abstract readonly databaseType: DatabaseType;

  // --- Abstract methods subclasses must implement ---

  /** Database-specific connection establishment */
  protected abstract doConnect(config: ConnectionConfig): Promise<void>;

  /** Database-specific disconnection */
  protected abstract doDisconnect(): Promise<void>;

  /** Database-specific health check query (e.g. SELECT 1) */
  protected abstract getHealthCheckQuery(): string;

  /** SQL to list table names; receives optional schema filter */
  protected abstract getTableNamesQuery(schemaFilter?: string): string;

  /** SQL to list columns for a table */
  protected abstract getColumnsQuery(tableName: string, schemaFilter?: string): string;

  /** SQL to list primary key columns for a table */
  protected abstract getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string;

  /** SQL to list foreign keys for a table */
  protected abstract getForeignKeyQuery(tableName: string, schemaFilter?: string): string;

  /** Normalize a native DB type string to canonical form */
  abstract normalizeType(nativeType: string): string;

  /** Execute a query and return rows — subclasses implement with real driver */
  protected abstract executeQuery<T>(sql: string): Promise<T[]>;

  // --- Shared lifecycle ---

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      await withTimeout(this.doConnect(config), CONNECTION_TIMEOUT_MS);
      this._config = config;
      this._connected = true;
    } catch (err) {
      this._connected = false;
      if (err instanceof ConnectionError) throw err;
      const reason =
        err instanceof Error && err.message === 'TIMEOUT'
          ? 'Connection timed out after 30 seconds'
          : err instanceof Error
            ? err.message
            : String(err);
      throw new ConnectionError(config.databaseType, reason);
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return;
    try {
      await this.doDisconnect();
    } finally {
      this._connected = false;
      this._config = null;
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  async healthCheck(): Promise<boolean> {
    this.ensureConnected('healthCheck');
    try {
      await this.executeQuery(this.getHealthCheckQuery());
      return true;
    } catch {
      return false;
    }
  }

  async getTableNames(schemaFilter?: string): Promise<string[]> {
    this.ensureConnected('getTableNames');
    try {
      const sql = this.getTableNamesQuery(schemaFilter);
      const rows = await this.executeQuery<{ table_name: string }>(sql);
      return rows.map((r) => r.table_name);
    } catch (err) {
      if (err instanceof ConnectionLostError) throw err;
      throw new IntrospectionError('*', err instanceof Error ? err.message : String(err));
    }
  }

  async getTableSchema(tableName: string, schemaFilter?: string): Promise<TableSchema> {
    this.ensureConnected(`getTableSchema(${tableName})`);
    try {
      const columns = await this.fetchColumns(tableName, schemaFilter);
      if (columns.length === 0) {
        const allTables = await this.getTableNames(schemaFilter);
        const suggestions = findSimilar(tableName, allTables);
        throw new TableNotFoundError(tableName, suggestions);
      }
      const pk = await this.fetchPrimaryKey(tableName, schemaFilter);
      const fks = await this.fetchForeignKeys(tableName, schemaFilter);

      const pkColumnSet = new Set(pk.columns);

      const columnSchemas: ColumnSchema[] = columns.map((c) => ({
        name: c.column_name,
        dataType: this.normalizeType(c.data_type),
        nullable: c.is_nullable.toUpperCase() === 'YES',
        defaultValue: c.column_default,
        isPrimaryKey: pkColumnSet.has(c.column_name),
      }));

      return {
        tableName,
        schemaName: schemaFilter ?? this.defaultSchema(),
        columns: columnSchemas,
        primaryKey: pk,
        foreignKeys: fks,
      };
    } catch (err) {
      if (err instanceof TableNotFoundError) throw err;
      if (err instanceof ConnectionLostError) throw err;
      throw new IntrospectionError(tableName, err instanceof Error ? err.message : String(err));
    }
  }

  /** Default schema name when no filter is provided */
  protected defaultSchema(): string {
    return 'public';
  }

  // --- Internal helpers ---

  protected ensureConnected(operation: string): void {
    if (!this._connected) {
      throw new ConnectionLostError(operation);
    }
  }

  private async fetchColumns(tableName: string, schemaFilter?: string): Promise<RawColumnRow[]> {
    const sql = this.getColumnsQuery(tableName, schemaFilter);
    return this.executeQuery<RawColumnRow>(sql);
  }

  private async fetchPrimaryKey(tableName: string, schemaFilter?: string): Promise<PrimaryKeyInfo> {
    const sql = this.getPrimaryKeyQuery(tableName, schemaFilter);
    const rows = await this.executeQuery<RawPkRow>(sql);
    if (rows.length === 0) {
      return { constraintName: '', columns: [] };
    }
    return {
      constraintName: rows[0].constraint_name,
      columns: rows.map((r) => r.column_name),
    };
  }

  private async fetchForeignKeys(tableName: string, schemaFilter?: string): Promise<ForeignKeyInfo[]> {
    const sql = this.getForeignKeyQuery(tableName, schemaFilter);
    const rows = await this.executeQuery<RawFkRow>(sql);

    const grouped = new Map<string, { columns: string[]; refTable: string; refColumns: string[] }>();
    for (const row of rows) {
      let entry = grouped.get(row.constraint_name);
      if (!entry) {
        entry = { columns: [], refTable: row.referenced_table, refColumns: [] };
        grouped.set(row.constraint_name, entry);
      }
      entry.columns.push(row.column_name);
      entry.refColumns.push(row.referenced_column);
    }

    return Array.from(grouped.entries()).map(([name, info]) => ({
      constraintName: name,
      columns: info.columns,
      referencedTable: info.refTable,
      referencedColumns: info.refColumns,
    }));
  }
}

// --- Utility functions ---

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Simple Levenshtein-based similarity search.
 * Returns up to 5 table names with edit distance ≤ 3.
 */
function findSimilar(target: string, candidates: string[]): string[] {
  const lower = target.toLowerCase();
  const scored = candidates
    .map((c) => ({ name: c, dist: levenshtein(lower, c.toLowerCase()) }))
    .filter((s) => s.dist <= 3)
    .sort((a, b) => a.dist - b.dist);
  return scored.slice(0, 5).map((s) => s.name);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
