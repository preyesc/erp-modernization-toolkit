import pg from 'pg';
import type { ConnectionConfig, DatabaseType } from '../../models/types.js';
import { ConnectionError } from '../../models/errors.js';
import { BaseAdapter } from './base-adapter.js';

const { Client } = pg;

/**
 * PostgreSQL adapter.
 *
 * Uses `information_schema` for metadata queries and the `pg` driver.
 * Type normalisation maps PostgreSQL-native types (e.g. `character varying`,
 * `timestamp without time zone`) to canonical forms (`VARCHAR`, `TIMESTAMP`).
 */
export class PostgresAdapter extends BaseAdapter {
  readonly databaseType: DatabaseType = 'postgresql';
  private client: InstanceType<typeof Client> | null = null;

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    this.client = new Client({
      host: config.host,
      port: config.port,
      database: config.databaseName,
      user: config.username,
      password: config.password,
    });
    try {
      await this.client.connect();
    } catch (err) {
      this.client = null;
      throw new ConnectionError(
        config.databaseType,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  protected async doDisconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  protected getHealthCheckQuery(): string {
    return 'SELECT 1';
  }

  protected getTableNamesQuery(schemaFilter?: string): string {
    const schema = schemaFilter ?? 'public';
    return `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  }

  protected getColumnsQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'public';
    return (
      `SELECT column_name, data_type, is_nullable, column_default ` +
      `FROM information_schema.columns ` +
      `WHERE table_schema = '${schema}' AND table_name = '${tableName}' ` +
      `ORDER BY ordinal_position`
    );
  }

  protected getPrimaryKeyQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'public';
    return (
      `SELECT kcu.constraint_name, kcu.column_name ` +
      `FROM information_schema.table_constraints tc ` +
      `JOIN information_schema.key_column_usage kcu ` +
      `ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema ` +
      `WHERE tc.table_schema = '${schema}' AND tc.table_name = '${tableName}' ` +
      `AND tc.constraint_type = 'PRIMARY KEY' ` +
      `ORDER BY kcu.ordinal_position`
    );
  }

  protected getForeignKeyQuery(tableName: string, schemaFilter?: string): string {
    const schema = schemaFilter ?? 'public';
    return (
      `SELECT kcu.constraint_name, kcu.column_name, ` +
      `ccu.table_name AS referenced_table, ccu.column_name AS referenced_column ` +
      `FROM information_schema.table_constraints tc ` +
      `JOIN information_schema.key_column_usage kcu ` +
      `ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema ` +
      `JOIN information_schema.constraint_column_usage ccu ` +
      `ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema ` +
      `WHERE tc.table_schema = '${schema}' AND tc.table_name = '${tableName}' ` +
      `AND tc.constraint_type = 'FOREIGN KEY'`
    );
  }

  protected async executeQuery<T>(sql: string): Promise<T[]> {
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.query(sql);
    return result.rows as T[];
  }

  normalizeType(nativeType: string): string {
    return normalizePostgresType(nativeType);
  }

  protected defaultSchema(): string {
    return 'public';
  }
}

/** Normalize PostgreSQL native types to canonical form */
function normalizePostgresType(nativeType: string): string {
  const t = nativeType.toLowerCase().trim();

  if (t === 'integer' || t === 'int' || t === 'int4') return 'INTEGER';
  if (t === 'smallint' || t === 'int2') return 'SMALLINT';
  if (t === 'bigint' || t === 'int8') return 'BIGINT';
  if (t === 'serial') return 'INTEGER';
  if (t === 'bigserial') return 'BIGINT';
  if (t === 'real' || t === 'float4') return 'FLOAT';
  if (t === 'double precision' || t === 'float8') return 'DOUBLE';
  if (t.startsWith('numeric') || t.startsWith('decimal')) return 'DECIMAL';
  if (t === 'boolean' || t === 'bool') return 'BOOLEAN';
  if (t === 'character varying' || t.startsWith('varchar')) return 'VARCHAR';
  if (t === 'character' || t.startsWith('char')) return 'CHAR';
  if (t === 'text') return 'TEXT';
  if (t === 'date') return 'DATE';
  if (t === 'timestamp without time zone' || t === 'timestamp' || t.startsWith('timestamp')) return 'TIMESTAMP';
  if (t === 'time without time zone' || t === 'time') return 'TIME';
  if (t === 'bytea') return 'BLOB';
  if (t === 'uuid') return 'UUID';
  if (t === 'json' || t === 'jsonb') return 'JSON';
  if (t === 'xml') return 'XML';

  return nativeType.toUpperCase();
}
