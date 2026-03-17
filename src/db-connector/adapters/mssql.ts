import type { ConnectionConfig, DatabaseType } from '../../models/types.js';
import { ConnectionError } from '../../models/errors.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Microsoft SQL Server adapter.
 *
 * Uses `INFORMATION_SCHEMA` and `sys` catalog views for metadata queries.
 * Type normalisation maps SQL Server types (e.g. `nvarchar`, `datetime2`,
 * `uniqueidentifier`) to canonical forms.
 */
export class MssqlAdapter extends BaseAdapter {
  readonly databaseType: DatabaseType = 'mssql';

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    throw new ConnectionError(
      config.databaseType,
      'SQL Server driver (mssql/tedious) is not installed. Install it with: npm install mssql',
    );
  }

  protected async doDisconnect(): Promise<void> {
    // Real implementation would call pool.close()
  }

  protected getHealthCheckQuery(): string {
    return 'SELECT 1';
  }

  protected getTableNamesQuery(schemaFilter?: string): string {
    const schema = schemaFilter ?? 'dbo';
    return `SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schema}' AND TABLE_TYPE = 'BASE TABLE' ORDER BY table_name`;
  }

  protected getColumnsQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'dbo';
    return (
      `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, ` +
      `IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default ` +
      `FROM INFORMATION_SCHEMA.COLUMNS ` +
      `WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${tableName}' ` +
      `ORDER BY ORDINAL_POSITION`
    );
  }

  protected getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'dbo';
    return (
      `SELECT kcu.CONSTRAINT_NAME AS constraint_name, kcu.COLUMN_NAME AS column_name ` +
      `FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ` +
      `JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ` +
      `ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA ` +
      `WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.TABLE_NAME = '${tableName}' ` +
      `AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY' ` +
      `ORDER BY kcu.ORDINAL_POSITION`
    );
  }

  protected getForeignKeyQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'dbo';
    return (
      `SELECT fk.name AS constraint_name, ` +
      `COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name, ` +
      `OBJECT_NAME(fkc.referenced_object_id) AS referenced_table, ` +
      `COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column ` +
      `FROM sys.foreign_keys fk ` +
      `JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id ` +
      `WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = '${schema}' ` +
      `AND OBJECT_NAME(fk.parent_object_id) = '${tableName}'`
    );
  }

  protected async executeQuery<T>(_sql: string): Promise<T[]> {
    throw new Error('SQL Server driver (mssql) is not installed');
  }

  normalizeType(nativeType: string): string {
    return normalizeMssqlType(nativeType);
  }

  protected defaultSchema(): string {
    return 'dbo';
  }
}

/** Normalize SQL Server native types to canonical form */
function normalizeMssqlType(nativeType: string): string {
  const t = nativeType.toLowerCase().trim();

  if (t === 'int') return 'INTEGER';
  if (t === 'smallint' || t === 'tinyint') return 'SMALLINT';
  if (t === 'bigint') return 'BIGINT';
  if (t === 'real') return 'FLOAT';
  if (t === 'float') return 'DOUBLE';
  if (t.startsWith('decimal') || t.startsWith('numeric') || t === 'money' || t === 'smallmoney') return 'DECIMAL';
  if (t === 'bit') return 'BOOLEAN';
  if (t.startsWith('nvarchar') || t.startsWith('varchar')) return 'VARCHAR';
  if (t.startsWith('nchar') || t.startsWith('char')) return 'CHAR';
  if (t === 'ntext' || t === 'text') return 'TEXT';
  if (t === 'date') return 'DATE';
  if (t === 'datetime' || t === 'datetime2' || t === 'smalldatetime') return 'TIMESTAMP';
  if (t === 'datetimeoffset') return 'TIMESTAMP';
  if (t === 'time') return 'TIME';
  if (t === 'varbinary' || t === 'binary' || t === 'image') return 'BLOB';
  if (t === 'uniqueidentifier') return 'UUID';
  if (t === 'xml') return 'XML';

  return nativeType.toUpperCase();
}
