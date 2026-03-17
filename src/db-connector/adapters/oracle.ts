import type { ConnectionConfig, DatabaseType } from '../../models/types.js';
import { ConnectionError } from '../../models/errors.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Oracle Database adapter.
 *
 * Uses Oracle data dictionary views (`ALL_TAB_COLUMNS`, `ALL_CONSTRAINTS`,
 * `ALL_CONS_COLUMNS`) for metadata queries.
 * Type normalisation maps Oracle types (e.g. `NUMBER`, `VARCHAR2`,
 * `TIMESTAMP(6)`) to canonical forms.
 */
export class OracleAdapter extends BaseAdapter {
  readonly databaseType: DatabaseType = 'oracle';

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    throw new ConnectionError(
      config.databaseType,
      'Oracle driver (oracledb) is not installed. Install it with: npm install oracledb',
    );
  }

  protected async doDisconnect(): Promise<void> {
    // Real implementation would call connection.close()
  }

  protected getHealthCheckQuery(): string {
    return 'SELECT 1 FROM DUAL';
  }

  protected getTableNamesQuery(schemaFilter?: string): string {
    if (schemaFilter) {
      return `SELECT table_name FROM all_tables WHERE owner = '${schemaFilter.toUpperCase()}' ORDER BY table_name`;
    }
    return `SELECT table_name FROM user_tables ORDER BY table_name`;
  }

  protected getColumnsQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    if (schemaFilter) {
      return (
        `SELECT column_name, data_type, CASE WHEN nullable = 'Y' THEN 'YES' ELSE 'NO' END AS is_nullable, ` +
        `data_default AS column_default ` +
        `FROM all_tab_columns ` +
        `WHERE owner = '${schemaFilter.toUpperCase()}' AND table_name = '${upperTable}' ` +
        `ORDER BY column_id`
      );
    }
    return (
      `SELECT column_name, data_type, CASE WHEN nullable = 'Y' THEN 'YES' ELSE 'NO' END AS is_nullable, ` +
      `data_default AS column_default ` +
      `FROM user_tab_columns ` +
      `WHERE table_name = '${upperTable}' ` +
      `ORDER BY column_id`
    );
  }

  protected getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    if (schemaFilter) {
      return (
        `SELECT ac.constraint_name, acc.column_name ` +
        `FROM all_constraints ac ` +
        `JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name AND ac.owner = acc.owner ` +
        `WHERE ac.owner = '${schemaFilter.toUpperCase()}' AND ac.table_name = '${upperTable}' ` +
        `AND ac.constraint_type = 'P' ` +
        `ORDER BY acc.position`
      );
    }
    return (
      `SELECT uc.constraint_name, ucc.column_name ` +
      `FROM user_constraints uc ` +
      `JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name ` +
      `WHERE uc.table_name = '${upperTable}' AND uc.constraint_type = 'P' ` +
      `ORDER BY ucc.position`
    );
  }

  protected getForeignKeyQuery(tableName: string, schemaFilter?: string): string {
    const upperTable = tableName.toUpperCase();
    if (schemaFilter) {
      return (
        `SELECT ac.constraint_name, acc.column_name, ` +
        `rc.table_name AS referenced_table, rcc.column_name AS referenced_column ` +
        `FROM all_constraints ac ` +
        `JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name AND ac.owner = acc.owner ` +
        `JOIN all_constraints rc ON ac.r_constraint_name = rc.constraint_name AND ac.r_owner = rc.owner ` +
        `JOIN all_cons_columns rcc ON rc.constraint_name = rcc.constraint_name AND rc.owner = rcc.owner ` +
        `AND acc.position = rcc.position ` +
        `WHERE ac.owner = '${schemaFilter.toUpperCase()}' AND ac.table_name = '${upperTable}' ` +
        `AND ac.constraint_type = 'R'`
      );
    }
    return (
      `SELECT uc.constraint_name, ucc.column_name, ` +
      `rc.table_name AS referenced_table, rcc.column_name AS referenced_column ` +
      `FROM user_constraints uc ` +
      `JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name ` +
      `JOIN user_constraints rc ON uc.r_constraint_name = rc.constraint_name ` +
      `JOIN user_cons_columns rcc ON rc.constraint_name = rcc.constraint_name ` +
      `AND ucc.position = rcc.position ` +
      `WHERE uc.table_name = '${upperTable}' AND uc.constraint_type = 'R'`
    );
  }

  protected async executeQuery<T>(_sql: string): Promise<T[]> {
    throw new Error('Oracle driver (oracledb) is not installed');
  }

  normalizeType(nativeType: string): string {
    return normalizeOracleType(nativeType);
  }

  protected defaultSchema(): string {
    return this._config?.username?.toUpperCase() ?? '';
  }
}

/** Normalize Oracle native types to canonical form */
function normalizeOracleType(nativeType: string): string {
  const t = nativeType.toLowerCase().trim();

  if (t === 'number' || t.startsWith('number(')) {
    // NUMBER with no scale or scale 0 → INTEGER, otherwise DECIMAL
    const match = t.match(/number\((\d+)(?:,\s*(\d+))?\)/);
    if (match) {
      const scale = match[2] ? parseInt(match[2], 10) : 0;
      return scale > 0 ? 'DECIMAL' : 'INTEGER';
    }
    return 'DECIMAL';
  }
  if (t === 'float' || t === 'binary_float') return 'FLOAT';
  if (t === 'binary_double') return 'DOUBLE';
  if (t.startsWith('varchar2') || t.startsWith('nvarchar2')) return 'VARCHAR';
  if (t.startsWith('char') || t.startsWith('nchar')) return 'CHAR';
  if (t === 'clob' || t === 'nclob' || t === 'long') return 'TEXT';
  if (t === 'date') return 'TIMESTAMP'; // Oracle DATE includes time
  if (t.startsWith('timestamp')) return 'TIMESTAMP';
  if (t === 'blob' || t === 'raw' || t.startsWith('long raw')) return 'BLOB';
  if (t === 'xmltype') return 'XML';

  return nativeType.toUpperCase();
}
