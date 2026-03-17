import type { ConnectionConfig, DatabaseType, IDbAdapter, IDbConnector } from '../models/types.js';
import { ConnectionError } from '../models/errors.js';
import { createAdapter } from './adapters/types.js';

const VALID_DATABASE_TYPES: ReadonlySet<string> = new Set<DatabaseType>([
  'postgresql',
  'mysql',
  'mssql',
  'oracle',
  'db2',
]);

/**
 * Manages the lifecycle of a database connection.
 * Validates configuration, resolves the correct adapter, and delegates
 * connection/disconnection to the underlying {@link IDbAdapter}.
 */
export class DbConnector implements IDbConnector {
  private adapter: IDbAdapter | null = null;
  private connected = false;

  async connect(config: ConnectionConfig): Promise<void> {
    this.validateConfig(config);

    const adapter = createAdapter(config.databaseType);

    try {
      await adapter.connect(config);
    } catch (err) {
      if (err instanceof ConnectionError) throw err;
      throw new ConnectionError(
        config.databaseType,
        err instanceof Error ? err.message : String(err),
      );
    }

    try {
      await adapter.healthCheck();
    } catch (err) {
      // Clean up the connection if health check fails
      try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
      throw new ConnectionError(
        config.databaseType,
        `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.adapter = adapter;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.adapter) return;

    try {
      await this.adapter.disconnect();
    } finally {
      this.adapter = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAdapter(): IDbAdapter {
    if (!this.adapter) {
      throw new ConnectionError('postgresql' as DatabaseType, 'No active connection. Call connect() first.');
    }
    return this.adapter;
  }

  /**
   * Validates that all required ConnectionConfig fields are present and valid.
   * Throws {@link ConnectionError} with a descriptive message on failure.
   */
  private validateConfig(config: ConnectionConfig): void {
    if (!config) {
      throw new ConnectionError('postgresql' as DatabaseType, 'ConnectionConfig is required');
    }

    if (!config.databaseType || !VALID_DATABASE_TYPES.has(config.databaseType)) {
      const provided = config.databaseType ?? 'undefined';
      throw new ConnectionError(
        (config.databaseType ?? 'postgresql') as DatabaseType,
        `Unsupported or missing database type: ${provided}. Supported types: ${[...VALID_DATABASE_TYPES].join(', ')}`,
      );
    }

    if (!config.host || config.host.trim() === '') {
      throw new ConnectionError(config.databaseType, 'Host must be a non-empty string');
    }

    if (typeof config.port !== 'number' || config.port <= 0 || !Number.isFinite(config.port)) {
      throw new ConnectionError(config.databaseType, 'Port must be a positive number');
    }

    if (!config.databaseName || config.databaseName.trim() === '') {
      throw new ConnectionError(config.databaseType, 'Database name must be a non-empty string');
    }

    if (!config.username || config.username.trim() === '') {
      throw new ConnectionError(config.databaseType, 'Username must be a non-empty string');
    }

    if (!config.password || config.password.trim() === '') {
      throw new ConnectionError(config.databaseType, 'Password must be a non-empty string');
    }
  }
}

// Barrel re-exports
export { DbIntrospector } from './introspector.js';
export { TableValidator } from './validator.js';
export { PlanEnricher } from './enricher.js';
export { createAdapter } from './adapters/types.js';
export type { IDbAdapter } from './adapters/types.js';
