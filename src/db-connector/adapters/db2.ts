import type { ConnectionConfig, DatabaseType } from '../../models/types.js';
import { ConnectionError } from '../../models/errors.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * IBM Db2 adapter.
 *
 * Uses `SYSCAT` catalog views for metadata queries.
 * Type normalisation maps Db2 types (e.g. `DECFLOAT`, `GRAPHIC`,
 * `TIMESTMP`) to canonical forms.
 */
export class Db2Adapter extends BaseAdapter {
  readonly databaseType: DatabaseType = 'db2';

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    throw new ConnectionError(
      config.databaseType,
      'Db2 driver (ibm_db) is not installed. Install it with: npm install ibm_db',
    );
  }

  protected async doDisconnect(): Promise<void> {
    // Real implementation would call conn.close()
  }

  protected getHealthCheckQuery(): string {
    return 'SELECT 1 FROM SYSIBM.SYSDUMMY1';
  }

  protected getTableNamesQuery(schemaFilter?: string): string {
    if (schemaFilter) {
      return `SELECT tabname AS table_name FROM syscat.tables WHERE tabschema = '${schemaFilter.toUpperCase()}' AND type = 'T' ORDER BY tabname`;
    }
    return `SELECT tabname AS table_name FROM syscat.tables WHERE tabschema = CURRENT SCHEMA AND type = 'T' ORDER BY tabname`;
  }

  protected getColumnsQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    const schemaClause = schemaFilter
      ? `tabschema = '${schemaFilter.toUpperCase()}'`
      : `tabschema = CURRENT SCHEMA`;
    return (
      `SELECT colname AS column_name, typename AS data_type, ` +
      `CASE WHEN nulls = 'Y' THEN 'YES' ELSE 'NO' END AS is_nullable, ` +
      `default AS column_default ` +
      `FROM syscat.columns ` +
      `WHERE ${schemaClause} AND tabname = '${upperTable}' ` +
      `ORDER BY colno`
    );
  }

  protected getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    const schemaClause = schemaFilter
      ? `tc.tabschema = '${schemaFilter.toUpperCase()}'`
      : `tc.tabschema = CURRENT SCHEMA`;
    return (
      `SELECT tc.constname AS constraint_name, kcu.colname AS column_name ` +
      `FROM syscat.tabconst tc ` +
      `JOIN syscat.keycoluse kcu ON tc.constname = kcu.constname AND tc.tabschema = kcu.tabschema ` +
      `WHERE ${schemaClause} AND tc.tabname = '${upperTable}' ` +
      `AND tc.type = 'P' ` +
      `ORDER BY kcu.colseq`
    );
  }

  protected getForeignKeyQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    const schemaClause = schemaFilter
      ? `r.tabschema = '${schemaFilter.toUpperCase()}'`
      : `r.tabschema = CURRENT SCHEMA`;
    return (
      `SELECT r.constname AS constraint_name, ` +
      `fk.colname AS column_name, ` +
      `r.reftabname AS referenced_table, ` +
      `pk.colname AS referenced_column ` +
      `FROM syscat.references r ` +
      `JOIN syscat.keycoluse fk ON r.constname = fk.constname AND r.tabschema = fk.tabschema ` +
      `JOIN syscat.keycoluse pk ON r.refkeyname = pk.constname AND r.reftabschema = pk.tabschema ` +
      `AND fk.colseq = pk.colseq ` +
      `WHERE ${schemaClause} AND r.tabname = '${upperTable}'`
    );
  }

  protected async executeQuery<T>(_sql: string): Promise<T[]> {
    throw new Error('Db2 driver (ibm_db) is not installed');
  }

  normalizeType(nativeType: string): string {
    return normalizeDb2Type(nativeType);
  }

  protected defaultSchema(): string {
    return this._config?.username?.toUpperCase() ?? '';
  }
}

/** Normalize IBM Db2 native types to canonical form */
function normalizeDb2Type(nativeType: string): string {
  const t = nativeType.toLowerCase().trim();

  if (t === 'integer' || t === 'int') return 'INTEGER';
  if (t === 'smallint') return 'SMALLINT';
  if (t === 'bigint') return 'BIGINT';
  if (t === 'real') return 'FLOAT';
  if (t === 'double' || t === 'float') return 'DOUBLE';
  if (t.startsWith('decimal') || t.startsWith('numeric') || t === 'decfloat') return 'DECIMAL';
  if (t === 'boolean') return 'BOOLEAN';
  if (t.startsWith('varchar') || t.startsWith('vargraphic')) return 'VARCHAR';
  if (t.startsWith('character') || t.startsWith('char') || t.startsWith('graphic')) return 'CHAR';
  if (t === 'clob' || t === 'dbclob' || t === 'long varchar') return 'TEXT';
  if (t === 'date') return 'DATE';
  if (t === 'timestamp' || t.startsWith('timestamp')) return 'TIMESTAMP';
  if (t === 'time') return 'TIME';
  if (t === 'blob' || t.startsWith('binary') || t.startsWith('varbinary')) return 'BLOB';
  if (t === 'xml') return 'XML';

  return nativeType.toUpperCase();
}
