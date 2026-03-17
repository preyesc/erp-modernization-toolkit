import type { IDbAdapter, IDbIntrospector, TableSchema } from '../models/types.js';
import { ConnectionLostError, TableNotFoundError } from '../models/errors.js';

/**
 * Retrieves schema information from a live database via an {@link IDbAdapter}.
 *
 * Wraps adapter calls with consistent error handling:
 * - {@link TableNotFoundError} propagates with fuzzy-match suggestions.
 * - Connection failures are wrapped in {@link ConnectionLostError}.
 */
export class DbIntrospector implements IDbIntrospector {
  constructor(private readonly adapter: IDbAdapter) {}

  async listTables(schemaFilter?: string): Promise<string[]> {
    try {
      return await this.adapter.getTableNames(schemaFilter);
    } catch (err) {
      throw this.wrapConnectionError(err, 'listTables');
    }
  }

  async getTableSchema(tableName: string, schemaFilter?: string): Promise<TableSchema> {
    try {
      return await this.adapter.getTableSchema(tableName, schemaFilter);
    } catch (err) {
      if (err instanceof TableNotFoundError) throw err;
      throw this.wrapConnectionError(err, `getTableSchema(${tableName})`);
    }
  }

  async getMultipleTableSchemas(
    tableNames: string[],
    schemaFilter?: string,
  ): Promise<Map<string, TableSchema | null>> {
    const result = new Map<string, TableSchema | null>();

    for (const name of tableNames) {
      try {
        const schema = await this.getTableSchema(name, schemaFilter);
        result.set(name, schema);
      } catch (err) {
        if (err instanceof TableNotFoundError) {
          result.set(name, null);
        } else {
          throw err;
        }
      }
    }

    return result;
  }

  /**
   * Wraps non-connection errors in {@link ConnectionLostError}.
   * If the error is already a {@link ConnectionLostError}, re-throws as-is.
   */
  private wrapConnectionError(err: unknown, operation: string): never {
    if (err instanceof ConnectionLostError) throw err;
    throw new ConnectionLostError(operation);
  }
}
