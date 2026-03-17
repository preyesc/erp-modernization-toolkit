import { describe, it, expect, vi } from 'vitest';
import { DbIntrospector } from '../../../src/db-connector/introspector';
import type { IDbAdapter, TableSchema } from '../../../src/models/types';
import { ConnectionLostError, TableNotFoundError } from '../../../src/models/errors';

function createMockAdapter(overrides: Partial<IDbAdapter> = {}): IDbAdapter {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getTableNames: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

const sampleSchema: TableSchema = {
  tableName: 'orders',
  schemaName: 'public',
  columns: [
    { name: 'id', dataType: 'INTEGER', nullable: false, defaultValue: null, isPrimaryKey: true },
    { name: 'customer_id', dataType: 'INTEGER', nullable: false, defaultValue: null, isPrimaryKey: false },
    { name: 'total', dataType: 'DECIMAL', nullable: true, defaultValue: null, isPrimaryKey: false },
  ],
  primaryKey: { constraintName: 'orders_pkey', columns: ['id'] },
  foreignKeys: [
    {
      constraintName: 'orders_customer_fk',
      columns: ['customer_id'],
      referencedTable: 'customers',
      referencedColumns: ['id'],
    },
  ],
};

describe('DbIntrospector', () => {
  describe('listTables', () => {
    it('should return table names from the adapter', async () => {
      const adapter = createMockAdapter({
        getTableNames: vi.fn().mockResolvedValue(['orders', 'customers', 'products']),
      });
      const introspector = new DbIntrospector(adapter);

      const tables = await introspector.listTables();

      expect(tables).toEqual(['orders', 'customers', 'products']);
      expect(adapter.getTableNames).toHaveBeenCalledWith(undefined);
    });

    it('should pass schema filter to the adapter', async () => {
      const adapter = createMockAdapter({
        getTableNames: vi.fn().mockResolvedValue(['sales.orders']),
      });
      const introspector = new DbIntrospector(adapter);

      await introspector.listTables('sales');

      expect(adapter.getTableNames).toHaveBeenCalledWith('sales');
    });

    it('should wrap connection errors in ConnectionLostError', async () => {
      const adapter = createMockAdapter({
        getTableNames: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      });
      const introspector = new DbIntrospector(adapter);

      await expect(introspector.listTables()).rejects.toThrow(ConnectionLostError);
    });

    it('should re-throw ConnectionLostError as-is', async () => {
      const original = new ConnectionLostError('getTableNames');
      const adapter = createMockAdapter({
        getTableNames: vi.fn().mockRejectedValue(original),
      });
      const introspector = new DbIntrospector(adapter);

      await expect(introspector.listTables()).rejects.toBe(original);
    });
  });

  describe('getTableSchema', () => {
    it('should return the table schema from the adapter', async () => {
      const adapter = createMockAdapter({
        getTableSchema: vi.fn().mockResolvedValue(sampleSchema),
      });
      const introspector = new DbIntrospector(adapter);

      const schema = await introspector.getTableSchema('orders');

      expect(schema).toEqual(sampleSchema);
      expect(adapter.getTableSchema).toHaveBeenCalledWith('orders', undefined);
    });

    it('should pass schema filter to the adapter', async () => {
      const adapter = createMockAdapter({
        getTableSchema: vi.fn().mockResolvedValue(sampleSchema),
      });
      const introspector = new DbIntrospector(adapter);

      await introspector.getTableSchema('orders', 'sales');

      expect(adapter.getTableSchema).toHaveBeenCalledWith('orders', 'sales');
    });

    it('should propagate TableNotFoundError with suggestions', async () => {
      const notFound = new TableNotFoundError('ordrs', ['orders']);
      const adapter = createMockAdapter({
        getTableSchema: vi.fn().mockRejectedValue(notFound),
      });
      const introspector = new DbIntrospector(adapter);

      await expect(introspector.getTableSchema('ordrs')).rejects.toThrow(TableNotFoundError);
      await expect(introspector.getTableSchema('ordrs')).rejects.toBe(notFound);
    });

    it('should wrap connection errors in ConnectionLostError', async () => {
      const adapter = createMockAdapter({
        getTableSchema: vi.fn().mockRejectedValue(new Error('socket hang up')),
      });
      const introspector = new DbIntrospector(adapter);

      const err = await introspector.getTableSchema('orders').catch((e) => e);
      expect(err).toBeInstanceOf(ConnectionLostError);
      expect(err.message).toContain('getTableSchema(orders)');
    });
  });

  describe('getMultipleTableSchemas', () => {
    it('should return a map of schemas for all requested tables', async () => {
      const customersSchema: TableSchema = {
        ...sampleSchema,
        tableName: 'customers',
        foreignKeys: [],
      };
      const adapter = createMockAdapter({
        getTableSchema: vi.fn()
          .mockResolvedValueOnce(sampleSchema)
          .mockResolvedValueOnce(customersSchema),
      });
      const introspector = new DbIntrospector(adapter);

      const result = await introspector.getMultipleTableSchemas(['orders', 'customers']);

      expect(result.size).toBe(2);
      expect(result.get('orders')).toEqual(sampleSchema);
      expect(result.get('customers')).toEqual(customersSchema);
    });

    it('should return null for tables that are not found', async () => {
      const adapter = createMockAdapter({
        getTableSchema: vi.fn()
          .mockResolvedValueOnce(sampleSchema)
          .mockRejectedValueOnce(new TableNotFoundError('missing_table', []))
          .mockResolvedValueOnce({ ...sampleSchema, tableName: 'products' }),
      });
      const introspector = new DbIntrospector(adapter);

      const result = await introspector.getMultipleTableSchemas(['orders', 'missing_table', 'products']);

      expect(result.size).toBe(3);
      expect(result.get('orders')).toEqual(sampleSchema);
      expect(result.get('missing_table')).toBeNull();
      expect(result.get('products')).toEqual({ ...sampleSchema, tableName: 'products' });
    });

    it('should propagate ConnectionLostError and stop processing', async () => {
      const adapter = createMockAdapter({
        getTableSchema: vi.fn()
          .mockResolvedValueOnce(sampleSchema)
          .mockRejectedValueOnce(new ConnectionLostError('getTableSchema(customers)')),
      });
      const introspector = new DbIntrospector(adapter);

      await expect(
        introspector.getMultipleTableSchemas(['orders', 'customers', 'products']),
      ).rejects.toThrow(ConnectionLostError);
    });

    it('should return an empty map for an empty table list', async () => {
      const adapter = createMockAdapter();
      const introspector = new DbIntrospector(adapter);

      const result = await introspector.getMultipleTableSchemas([]);

      expect(result.size).toBe(0);
    });
  });
});
