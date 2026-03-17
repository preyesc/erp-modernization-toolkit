import { describe, it, expect } from 'vitest';
import { EnrichedSchemaMapper, generateOpenApiFromEnrichedPlan } from '../../../src/api-generator/index';
import type {
  TableSchema,
  EnrichedPlan,
  PlanMetadata,
  ProposedService,
} from '../../../src/models/types';

const mapper = new EnrichedSchemaMapper();

// ---------------------------------------------------------------------------
// Task 8.1 — EnrichedSchemaMapper
// ---------------------------------------------------------------------------

describe('EnrichedSchemaMapper', () => {
  describe('mapColumnType', () => {
    it('maps INTEGER to integer/int32', () => {
      expect(mapper.mapColumnType('INTEGER', 'postgresql')).toEqual({ type: 'integer', format: 'int32' });
    });

    it('maps INT to integer/int32', () => {
      expect(mapper.mapColumnType('INT', 'mysql')).toEqual({ type: 'integer', format: 'int32' });
    });

    it('maps SMALLINT to integer/int32', () => {
      expect(mapper.mapColumnType('SMALLINT', 'postgresql')).toEqual({ type: 'integer', format: 'int32' });
    });

    it('maps BIGINT to integer/int64', () => {
      expect(mapper.mapColumnType('BIGINT', 'postgresql')).toEqual({ type: 'integer', format: 'int64' });
    });

    it('maps VARCHAR(255) to string (no format)', () => {
      expect(mapper.mapColumnType('VARCHAR(255)', 'postgresql')).toEqual({ type: 'string' });
    });

    it('maps TEXT to string', () => {
      expect(mapper.mapColumnType('TEXT', 'mysql')).toEqual({ type: 'string' });
    });

    it('maps CHAR(10) to string', () => {
      expect(mapper.mapColumnType('CHAR(10)', 'oracle')).toEqual({ type: 'string' });
    });

    it('maps BOOLEAN to boolean', () => {
      expect(mapper.mapColumnType('BOOLEAN', 'postgresql')).toEqual({ type: 'boolean' });
    });

    it('maps BIT to boolean', () => {
      expect(mapper.mapColumnType('BIT', 'mssql')).toEqual({ type: 'boolean' });
    });

    it('maps TIMESTAMP to string/date-time', () => {
      expect(mapper.mapColumnType('TIMESTAMP', 'postgresql')).toEqual({ type: 'string', format: 'date-time' });
    });

    it('maps DATETIME to string/date-time', () => {
      expect(mapper.mapColumnType('DATETIME', 'mysql')).toEqual({ type: 'string', format: 'date-time' });
    });

    it('maps DATE to string/date', () => {
      expect(mapper.mapColumnType('DATE', 'oracle')).toEqual({ type: 'string', format: 'date' });
    });

    it('maps DECIMAL to number/double', () => {
      expect(mapper.mapColumnType('DECIMAL', 'postgresql')).toEqual({ type: 'number', format: 'double' });
    });

    it('maps DECIMAL(10,2) to number/double', () => {
      expect(mapper.mapColumnType('DECIMAL(10,2)', 'mssql')).toEqual({ type: 'number', format: 'double' });
    });

    it('maps FLOAT to number/float', () => {
      expect(mapper.mapColumnType('FLOAT', 'mysql')).toEqual({ type: 'number', format: 'float' });
    });

    it('maps DOUBLE to number/double', () => {
      expect(mapper.mapColumnType('DOUBLE', 'mysql')).toEqual({ type: 'number', format: 'double' });
    });

    it('maps NUMERIC to number/double', () => {
      expect(mapper.mapColumnType('NUMERIC', 'postgresql')).toEqual({ type: 'number', format: 'double' });
    });

    it('maps BLOB to string/byte', () => {
      expect(mapper.mapColumnType('BLOB', 'oracle')).toEqual({ type: 'string', format: 'byte' });
    });

    it('maps BYTEA to string/byte', () => {
      expect(mapper.mapColumnType('BYTEA', 'postgresql')).toEqual({ type: 'string', format: 'byte' });
    });

    it('maps UUID to string/uuid', () => {
      expect(mapper.mapColumnType('UUID', 'postgresql')).toEqual({ type: 'string', format: 'uuid' });
    });

    it('maps CLOB to string (no format)', () => {
      expect(mapper.mapColumnType('CLOB', 'oracle')).toEqual({ type: 'string' });
    });

    it('is case-insensitive', () => {
      expect(mapper.mapColumnType('integer', 'postgresql')).toEqual({ type: 'integer', format: 'int32' });
      expect(mapper.mapColumnType('Varchar(50)', 'mysql')).toEqual({ type: 'string' });
    });
  });

  describe('mapTableSchemaToOpenApi', () => {
    const ordersSchema: TableSchema = {
      tableName: 'orders',
      schemaName: 'public',
      columns: [
        { name: 'id', dataType: 'INTEGER', nullable: false, defaultValue: null, isPrimaryKey: true },
        { name: 'customer_id', dataType: 'INTEGER', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'total', dataType: 'DECIMAL(10,2)', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'created_at', dataType: 'TIMESTAMP', nullable: true, defaultValue: 'NOW()', isPrimaryKey: false },
      ],
      primaryKey: { constraintName: 'orders_pkey', columns: ['id'] },
      foreignKeys: [],
    };

    it('creates a property for every column', () => {
      const result = mapper.mapTableSchemaToOpenApi(ordersSchema);
      expect(Object.keys(result.properties!)).toEqual(['id', 'customer_id', 'total', 'created_at']);
    });

    it('maps column types correctly', () => {
      const result = mapper.mapTableSchemaToOpenApi(ordersSchema);
      expect(result.properties!['id']).toEqual({ type: 'integer', format: 'int32' });
      expect(result.properties!['total']).toEqual({ type: 'number', format: 'double' });
      expect(result.properties!['created_at']).toEqual({ type: 'string', format: 'date-time' });
    });

    it('populates required array with non-nullable columns', () => {
      const result = mapper.mapTableSchemaToOpenApi(ordersSchema);
      expect(result.required).toEqual(['id', 'customer_id']);
    });

    it('omits required array when all columns are nullable', () => {
      const allNullable: TableSchema = {
        tableName: 'notes',
        schemaName: 'public',
        columns: [
          { name: 'content', dataType: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
        ],
        primaryKey: { constraintName: '', columns: [] },
        foreignKeys: [],
      };
      const result = mapper.mapTableSchemaToOpenApi(allNullable);
      expect(result.required).toBeUndefined();
    });

    it('sets type to object', () => {
      const result = mapper.mapTableSchemaToOpenApi(ordersSchema);
      expect(result.type).toBe('object');
    });
  });
});

// ---------------------------------------------------------------------------
// Task 8.2 — generateOpenApiFromEnrichedPlan
// ---------------------------------------------------------------------------

describe('generateOpenApiFromEnrichedPlan', () => {
  const basePlan: EnrichedPlan = {
    metadata: {
      createdAt: '2024-01-01',
      sourceReportId: 'test',
      toolkitVersion: '1.0.0',
      totalServices: 1,
    },
    services: [
      {
        name: 'OrderService',
        description: 'Handles orders',
        modules: [],
        tables: ['orders', 'missing_table'],
        riskLevel: 'low',
        externalDependencies: [],
      },
    ],
    sharedTables: [],
    circularDependencies: [],
    enrichment: {
      enrichedAt: '2024-01-01',
      databaseType: 'postgresql',
      serviceSchemas: [
        {
          serviceName: 'OrderService',
          tableSchemas: [
            {
              tableName: 'orders',
              schemaName: 'public',
              columns: [
                { name: 'id', dataType: 'INTEGER', nullable: false, defaultValue: null, isPrimaryKey: true },
                { name: 'amount', dataType: 'DECIMAL', nullable: true, defaultValue: null, isPrimaryKey: false },
              ],
              primaryKey: { constraintName: 'orders_pkey', columns: ['id'] },
              foreignKeys: [],
            },
          ],
        },
      ],
      crossServiceForeignKeys: [],
      unvalidatedTables: ['missing_table'],
    },
  };

  it('generates one spec per service', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    expect(specs).toHaveLength(1);
    expect(specs[0].info.title).toBe('OrderService API');
  });

  it('uses real schema for validated tables', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    const schema = specs[0].components.schemas['Orders'];
    expect(schema).toBeDefined();
    expect(schema.properties!['id']).toEqual({ type: 'integer', format: 'int32' });
    expect(schema.properties!['amount']).toEqual({ type: 'number', format: 'double' });
  });

  it('uses PK columns as path parameters', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    const itemPath = specs[0].paths['/orders/{id}'];
    expect(itemPath).toBeDefined();
    const getOp = itemPath.get!;
    expect(getOp.parameters).toHaveLength(1);
    expect(getOp.parameters![0].name).toBe('id');
    expect(getOp.parameters![0].in).toBe('path');
    expect(getOp.parameters![0].required).toBe(true);
    expect(getOp.parameters![0].schema.type).toBe('integer');
  });

  it('falls back to inferred schema for unvalidated tables with warning', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    const schema = specs[0].components.schemas['MissingTable'];
    expect(schema).toBeDefined();
    expect(schema.properties!['id']).toBeDefined();

    // Check that paths include a warning
    const listPath = specs[0].paths['/missing_table'];
    expect(listPath).toBeDefined();
    expect(listPath.get!.summary).toContain('WARNING');
    expect(listPath.get!.summary).toContain('not validated');
  });

  it('generates collection and item endpoints for validated tables', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    expect(specs[0].paths['/orders']).toBeDefined();
    expect(specs[0].paths['/orders'].get).toBeDefined();
    expect(specs[0].paths['/orders'].post).toBeDefined();
    expect(specs[0].paths['/orders/{id}']).toBeDefined();
    expect(specs[0].paths['/orders/{id}'].get).toBeDefined();
    expect(specs[0].paths['/orders/{id}'].put).toBeDefined();
    expect(specs[0].paths['/orders/{id}'].delete).toBeDefined();
  });

  it('sets openapi version to 3.0.3', () => {
    const specs = generateOpenApiFromEnrichedPlan(basePlan);
    expect(specs[0].openapi).toBe('3.0.3');
  });
});
