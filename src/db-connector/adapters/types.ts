export type { IDbAdapter, DatabaseType, ConnectionConfig, TableSchema } from '../../models/types.js';

import type { DatabaseType, IDbAdapter } from '../../models/types.js';
import { PostgresAdapter } from './postgres.js';
import { MysqlAdapter } from './mysql.js';
import { MssqlAdapter } from './mssql.js';
import { OracleAdapter } from './oracle.js';
import { Db2Adapter } from './db2.js';

export function createAdapter(databaseType: DatabaseType): IDbAdapter {
  switch (databaseType) {
    case 'postgresql':
      return new PostgresAdapter();
    case 'mysql':
      return new MysqlAdapter();
    case 'mssql':
      return new MssqlAdapter();
    case 'oracle':
      return new OracleAdapter();
    case 'db2':
      return new Db2Adapter();
    default:
      throw new Error(`Unsupported database type: ${databaseType as string}`);
  }
}
