import type {
  ColumnSchema,
  DatabaseType,
  EnrichedPlan,
  IEnrichedSchemaMapper,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiPathItem,
  OpenApiSchema,
  OpenApiSchemaProperty,
  OpenApiSpec,
  ProposedService,
  ServiceSchemaMap,
  TableInfo,
  TableSchema,
} from '../models/types.js';

/**
 * Maps real {@link TableSchema} column types to OpenAPI schema properties.
 *
 * Implements the {@link IEnrichedSchemaMapper} interface, providing accurate
 * OpenAPI schemas based on actual database column metadata rather than
 * inferred types.
 */
export class EnrichedSchemaMapper implements IEnrichedSchemaMapper {
  /**
   * Maps a full {@link TableSchema} to an {@link OpenApiSchema}.
   *
   * Every column becomes a property in the schema. Non-nullable columns are
   * added to the `required` array.
   */
  mapTableSchemaToOpenApi(schema: TableSchema): OpenApiSchema {
    const properties: Record<string, OpenApiSchemaProperty> = {};
    const required: string[] = [];

    for (const column of schema.columns) {
      properties[column.name] = this.mapColumnType(column.dataType, 'postgresql');
      if (!column.nullable) {
        required.push(column.name);
      }
    }

    const result: OpenApiSchema = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      result.required = required;
    }

    return result;
  }

  /**
   * Maps a database column type string to an OpenAPI property with the
   * correct `type` and optional `format`.
   *
   * The mapping normalises the input to uppercase and strips size/precision
   * qualifiers (e.g. `VARCHAR(255)` → `VARCHAR`) before matching against
   * known categories.
   */
  mapColumnType(dbType: string, _databaseType: DatabaseType): OpenApiSchemaProperty {
    const normalised = dbType.toUpperCase().replace(/\(.*\)/, '').trim();

    // Integer types
    if (normalised === 'BIGINT') {
      return { type: 'integer', format: 'int64' };
    }
    if (['INTEGER', 'INT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'SERIAL'].includes(normalised)) {
      return { type: 'integer', format: 'int32' };
    }

    // Numeric / floating-point types
    if (['FLOAT', 'REAL'].includes(normalised)) {
      return { type: 'number', format: 'float' };
    }
    if (['DOUBLE', 'DOUBLE PRECISION', 'DECIMAL', 'NUMERIC', 'NUMBER', 'MONEY'].includes(normalised)) {
      return { type: 'number', format: 'double' };
    }

    // Boolean
    if (['BOOLEAN', 'BOOL', 'BIT'].includes(normalised)) {
      return { type: 'boolean' };
    }

    // Date / time
    if (normalised === 'DATE') {
      return { type: 'string', format: 'date' };
    }
    if (['TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE', 'DATETIME', 'DATETIME2', 'SMALLDATETIME'].includes(normalised)) {
      return { type: 'string', format: 'date-time' };
    }

    // Binary
    if (['BLOB', 'BYTEA', 'BINARY', 'VARBINARY', 'IMAGE', 'RAW', 'LONG RAW'].includes(normalised)) {
      return { type: 'string', format: 'byte' };
    }

    // UUID
    if (['UUID', 'UNIQUEIDENTIFIER'].includes(normalised)) {
      return { type: 'string', format: 'uuid' };
    }

    // String types (VARCHAR, CHAR, TEXT, CLOB, NVARCHAR, etc.) — default
    return { type: 'string' };
  }
}


// ---------------------------------------------------------------------------
// Enriched API Generator — Task 8.2
// ---------------------------------------------------------------------------

/**
 * Generates OpenAPI specs from an {@link EnrichedPlan}, using real
 * {@link TableSchema} data for validated tables and falling back to inferred
 * schemas for unvalidated ones.
 */
export function generateOpenApiFromEnrichedPlan(
  enrichedPlan: EnrichedPlan,
  mapper: IEnrichedSchemaMapper = new EnrichedSchemaMapper(),
): OpenApiSpec[] {
  const unvalidatedSet = new Set(enrichedPlan.enrichment.unvalidatedTables);

  return enrichedPlan.services.map((service) => {
    const serviceSchemaMap = enrichedPlan.enrichment.serviceSchemas.find(
      (s) => s.serviceName === service.name,
    );

    const schemas: Record<string, OpenApiSchema> = {};
    const paths: Record<string, OpenApiPathItem> = {};

    // Process validated tables with real schemas
    if (serviceSchemaMap) {
      for (const tableSchema of serviceSchemaMap.tableSchemas) {
        const schemaName = toPascalCase(tableSchema.tableName);
        schemas[schemaName] = mapper.mapTableSchemaToOpenApi(tableSchema);
        Object.assign(paths, buildCrudPaths(tableSchema, schemaName, mapper));
      }
    }

    // Fall back to inferred schemas for unvalidated tables
    for (const tableName of service.tables) {
      if (unvalidatedSet.has(tableName)) {
        const schemaName = toPascalCase(tableName);
        schemas[schemaName] = buildInferredSchema(tableName);
        Object.assign(paths, buildInferredCrudPaths(tableName, schemaName));
      }
    }

    return {
      openapi: '3.0.3',
      info: {
        title: `${service.name} API`,
        version: '1.0.0',
        description: service.description,
      },
      paths,
      components: { schemas },
    };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds CRUD path items for a validated table, using PK columns as path
 * parameters for single-resource endpoints.
 */
function buildCrudPaths(
  tableSchema: TableSchema,
  schemaName: string,
  mapper: IEnrichedSchemaMapper,
): Record<string, OpenApiPathItem> {
  const paths: Record<string, OpenApiPathItem> = {};
  const basePath = `/${tableSchema.tableName}`;
  const pkColumns = tableSchema.primaryKey.columns;

  // Collection endpoint: GET (list) + POST (create)
  paths[basePath] = {
    get: {
      summary: `List all ${tableSchema.tableName}`,
      operationId: `list${schemaName}`,
      responses: {
        '200': {
          description: `List of ${tableSchema.tableName}`,
          content: {
            'application/json': {
              schema: { type: 'array', properties: { items: { type: 'string', description: `Array of ${schemaName}` } } },
            },
          },
        },
      },
    },
    post: {
      summary: `Create a new ${tableSchema.tableName} entry`,
      operationId: `create${schemaName}`,
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
        },
      },
      responses: {
        '201': {
          description: `Created ${tableSchema.tableName}`,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
          },
        },
      },
    },
  };

  // Single-resource endpoint with PK path parameters: GET, PUT, DELETE
  if (pkColumns.length > 0) {
    const pkPathSegments = pkColumns.map((col) => `{${col}}`).join('/');
    const itemPath = `${basePath}/${pkPathSegments}`;
    const pkParams = buildPkParameters(tableSchema, mapper);

    paths[itemPath] = {
      get: {
        summary: `Get ${tableSchema.tableName} by primary key`,
        operationId: `get${schemaName}ById`,
        parameters: pkParams,
        responses: {
          '200': {
            description: `A single ${tableSchema.tableName}`,
            content: {
              'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
            },
          },
          '404': { description: `${tableSchema.tableName} not found` },
        },
      },
      put: {
        summary: `Update ${tableSchema.tableName} by primary key`,
        operationId: `update${schemaName}ById`,
        parameters: pkParams,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
          },
        },
        responses: {
          '200': {
            description: `Updated ${tableSchema.tableName}`,
            content: {
              'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
            },
          },
          '404': { description: `${tableSchema.tableName} not found` },
        },
      },
      delete: {
        summary: `Delete ${tableSchema.tableName} by primary key`,
        operationId: `delete${schemaName}ById`,
        parameters: pkParams,
        responses: {
          '204': { description: `Deleted ${tableSchema.tableName}` },
          '404': { description: `${tableSchema.tableName} not found` },
        },
      },
    };
  }

  return paths;
}

/**
 * Builds OpenAPI path parameters for each primary key column.
 */
function buildPkParameters(
  tableSchema: TableSchema,
  mapper: IEnrichedSchemaMapper,
): OpenApiParameter[] {
  return tableSchema.primaryKey.columns.map((colName) => {
    const column = tableSchema.columns.find((c) => c.name === colName);
    const mapped = column
      ? mapper.mapColumnType(column.dataType, 'postgresql')
      : { type: 'string' };

    return {
      name: colName,
      in: 'path' as const,
      required: true,
      schema: { type: mapped.type, ...(mapped.format ? { format: mapped.format } : {}) },
      description: `Primary key column: ${colName}`,
    };
  });
}

/**
 * Builds a minimal inferred schema for an unvalidated table, including a
 * warning description.
 */
function buildInferredSchema(tableName: string): OpenApiSchema {
  return {
    type: 'object',
    properties: {
      id: { type: 'integer', format: 'int32', description: 'Inferred primary key' },
    },
    required: ['id'],
  };
}

/**
 * Builds basic CRUD paths for an unvalidated table using inferred schema.
 * Includes a warning in the operation summaries.
 */
function buildInferredCrudPaths(
  tableName: string,
  schemaName: string,
): Record<string, OpenApiPathItem> {
  const basePath = `/${tableName}`;
  const warning = ' [WARNING: schema inferred — table not validated against database]';

  return {
    [basePath]: {
      get: {
        summary: `List all ${tableName}${warning}`,
        operationId: `list${schemaName}`,
        responses: {
          '200': {
            description: `List of ${tableName}${warning}`,
          },
        },
      },
      post: {
        summary: `Create a new ${tableName} entry${warning}`,
        operationId: `create${schemaName}`,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
          },
        },
        responses: {
          '201': {
            description: `Created ${tableName}`,
          },
        },
      },
    },
    [`${basePath}/{id}`]: {
      get: {
        summary: `Get ${tableName} by ID${warning}`,
        operationId: `get${schemaName}ById`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', format: 'int32' },
            description: `Inferred primary key for ${tableName}`,
          },
        ],
        responses: {
          '200': {
            description: `A single ${tableName}${warning}`,
          },
          '404': { description: `${tableName} not found` },
        },
      },
      put: {
        summary: `Update ${tableName} by ID${warning}`,
        operationId: `update${schemaName}ById`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', format: 'int32' },
            description: `Inferred primary key for ${tableName}`,
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } },
          },
        },
        responses: {
          '200': {
            description: `Updated ${tableName}${warning}`,
          },
          '404': { description: `${tableName} not found` },
        },
      },
      delete: {
        summary: `Delete ${tableName} by ID${warning}`,
        operationId: `delete${schemaName}ById`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', format: 'int32' },
            description: `Inferred primary key for ${tableName}`,
          },
        ],
        responses: {
          '204': { description: `Deleted ${tableName}` },
          '404': { description: `${tableName} not found` },
        },
      },
    },
  };
}

/**
 * Converts a snake_case or plain string to PascalCase for schema names.
 */
function toPascalCase(input: string): string {
  return input
    .split(/[_\-\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}
