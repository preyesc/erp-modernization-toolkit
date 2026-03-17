import type { ConnectionConfig, DatabaseType } from '../../models/types.js';
import { ConnectionError } from '../../models/errors.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * MySQL adapter.
 *
 * Uses `information_schema` for metadata queries.
 * Type normalisation maps MySQL-native types (e.g. `int`, `varchar`,
 * `datetime`) to canonical forms.
 */
export class MysqlAdapter extends BaseAdapter {
  readonly databaseType: DatabaseType = 'mysql';

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    throw new ConnectionError(
      config.databaseType,
      'MySQL driver (mysql2) is not installed. Install it with: npm install mysql2',
    );
  }

  protected async doDisconnect(): Promise<void> {
    // Real implementation would call connection.end()
  }

  protected getHealthCheckQuery(): string {
    return 'SELECT 1';
  }

  protected getTableNamesQuery(schemaFilter?: string): string {
    const db = schemaFilter ? `'${schemaFilter}'` : 'DATABASE()';
    return `SELECT table_name FROM information_schema.tables WHERE table_schema = ${db} AND table_type = 'BASE TABLE' ORDER BY table_name`;
  }

  protected getColumnsQuery(tableName: string, schemaFilter?: string): string {
    const db = schemaFilter ? `'${schemaFilter}'` : 'DATABASE()';
    return (
      `SELECT column_name, data_type, is_nullable, column_default ` +
      `FROM information_schema.columns ` +
      `WHERE table_schema = ${db} AND table_name = '${tableName}' ` +
      `ORDER BY ordinal_position`
    );
  }

  protected getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string {
    const db = schemaFilter ? `'${schemaFilter}'` : 'DATABASE()';
    return (
      `SELECT constraint_name, column_name ` +
      `FROM information_schema.key_column_usage ` +
      `WHERE table_schema = ${db} AND table_name = '${tableName}' ` +
      `AND constraint_name = 'PRIMARY' ` +
      `ORDER BY ordinal_position`
    );
  }

  protected getForeignKeyQuery(tableName: string, schemaFilter?: string): string {
    const db = schemaFilter ? `'${schemaFilter}'` : 'DATABASE()';
    return (
      `SELECT kcu.constraint_name, kcu.column_name, ` +
      `kcu.referenced_table_name AS referenced_table, ` +
      `kcu.referenced_column_name AS referenced_column ` +
      `FROM information_schema.key_column_usage kcu ` +
      `WHERE kcu.table_schema = ${db} AND kcu.table_name = '${tableName}' ` +
      `AND kcu.referenced_table_name IS NOT NULL`
    );
  }

  protected async executeQuery<T>(_sql: string): Promise<T[]> {
    throw new Error('MySQL driver (mysql2) is not installed');
  }

  normalizeType(nativeType: string): string {
    return normalizeMysqlType(nativeType);
  }

  protected defaultSchema(): string {
    return this._config?.databaseName ?? '';
  }
}

/** Normalize MySQL native types to canonical form */
function normalizeMysqlType(nativeType: string): string {
  const t = nativeType.toLowerCase().trim();

  if (t === 'int' || t === 'integer' || t === 'mediumint') return 'INTEGER';
  if (t === 'smallint' || t === 'tinyint') return 'SMALLINT';
  if (t === 'bigint') return 'BIGINT';
  if (t === 'float') return 'FLOAT';
  if (t === 'double') return 'DOUBLE';
  if (t.startsWith('decimal') || t.startsWith('numeric')) return 'DECIMAL';
  if (t === 'boolean' || t === 'bool' || t === 'bit') return 'BOOLEAN';
  if (t.startsWith('varchar')) return 'VARCHAR';
  if (t.startsWith('char')) return 'CHAR';
  if (t === 'text' || t === 'mediumtext' || t === 'longtext' || t === 'tinytext') return 'TEXT';
  if (t === 'date') return 'DATE';
  if (t === 'datetime' || t === 'timestamp') return 'TIMESTAMP';
  if (t === 'time') return 'TIME';
  if (t === 'blob' || t === 'mediumblob' || t === 'longblob' || t === 'tinyblob') return 'BLOB';
  if (t === 'binary' || t === 'varbinary') return 'BLOB';
  if (t === 'json') return 'JSON';
  if (t === 'enum') return 'VARCHAR';
  if (t === 'set') return 'VARCHAR';

  return nativeType.toUpperCase();
}
