import type {
  ConnectionConfig,
  CrossServiceForeignKey,
  DecompositionPlan,
  EnrichedPlan,
  IDbIntrospector,
  IPlanEnricher,
  ServiceSchemaMap,
  TableSchema,
} from '../models/types.js';

/**
 * Augments a {@link DecompositionPlan} with real database metadata.
 *
 * For each service in the plan, retrieves {@link TableSchema} objects from the
 * live database via an {@link IDbIntrospector}. Tables that cannot be found are
 * recorded as unvalidated. Cross-service foreign key relationships are detected
 * and included in the enrichment data.
 *
 * Original plan fields are preserved unchanged (enrichment is additive).
 */
export class PlanEnricher implements IPlanEnricher {
  constructor(
    private readonly introspector: IDbIntrospector,
    private readonly config: ConnectionConfig,
  ) {}

  async enrich(plan: DecompositionPlan, schemaFilter?: string): Promise<EnrichedPlan> {
    // 1. Collect all unique table names across all services
    const allTableNames = this.collectUniqueTableNames(plan);

    // 2. Fetch schemas for all tables in one batch
    const schemaMap = await this.introspector.getMultipleTableSchemas(
      [...allTableNames],
      schemaFilter,
    );

    // 3. Build ServiceSchemaMap entries and track unvalidated tables
    const unvalidatedTables: string[] = [];
    const serviceSchemas: ServiceSchemaMap[] = this.buildServiceSchemas(
      plan,
      schemaMap,
      unvalidatedTables,
    );

    // 4. Build table-to-service lookup for cross-service FK detection
    const tableToService = this.buildTableToServiceMap(plan);

    // 5. Detect cross-service foreign key dependencies
    const crossServiceForeignKeys = this.detectCrossServiceForeignKeys(
      schemaMap,
      tableToService,
    );

    // 6. Spread original plan fields and add enrichment data
    return {
      ...plan,
      enrichment: {
        enrichedAt: new Date().toISOString(),
        databaseType: this.config.databaseType,
        serviceSchemas,
        crossServiceForeignKeys,
        unvalidatedTables,
      },
    };
  }

  /**
   * Collects all unique table names referenced by any service in the plan.
   */
  private collectUniqueTableNames(plan: DecompositionPlan): Set<string> {
    const tableNames = new Set<string>();
    for (const service of plan.services) {
      for (const table of service.tables) {
        tableNames.add(table);
      }
    }
    return tableNames;
  }

  /**
   * Builds a {@link ServiceSchemaMap} for each service, including only tables
   * whose schemas were successfully retrieved. Tables returning `null` are
   * added to the unvalidated list.
   */
  private buildServiceSchemas(
    plan: DecompositionPlan,
    schemaMap: Map<string, TableSchema | null>,
    unvalidatedTables: string[],
  ): ServiceSchemaMap[] {
    const unvalidatedSet = new Set<string>();

    const serviceSchemas: ServiceSchemaMap[] = plan.services.map((service) => {
      const tableSchemas: TableSchema[] = [];

      for (const tableName of service.tables) {
        const schema = schemaMap.get(tableName);
        if (schema) {
          tableSchemas.push(schema);
        } else {
          unvalidatedSet.add(tableName);
        }
      }

      return {
        serviceName: service.name,
        tableSchemas,
      };
    });

    // Deduplicate unvalidated tables (a table may be referenced by multiple services)
    unvalidatedTables.push(...unvalidatedSet);

    return serviceSchemas;
  }

  /**
   * Builds a map from table name to the service that owns it.
   * If a table appears in multiple services, the first service wins.
   */
  private buildTableToServiceMap(plan: DecompositionPlan): Map<string, string> {
    const tableToService = new Map<string, string>();
    for (const service of plan.services) {
      for (const table of service.tables) {
        if (!tableToService.has(table)) {
          tableToService.set(table, service.name);
        }
      }
    }
    return tableToService;
  }

  /**
   * Detects foreign keys that cross service boundaries.
   *
   * For each retrieved table schema, inspects its foreign keys. If a FK
   * references a table assigned to a different service, a
   * {@link CrossServiceForeignKey} entry is created.
   */
  private detectCrossServiceForeignKeys(
    schemaMap: Map<string, TableSchema | null>,
    tableToService: Map<string, string>,
  ): CrossServiceForeignKey[] {
    const crossServiceFKs: CrossServiceForeignKey[] = [];

    for (const [tableName, schema] of schemaMap) {
      if (!schema) continue;

      const sourceService = tableToService.get(tableName);
      if (!sourceService) continue;

      for (const fk of schema.foreignKeys) {
        const targetService = tableToService.get(fk.referencedTable);
        if (!targetService) continue;

        if (sourceService !== targetService) {
          crossServiceFKs.push({
            sourceService,
            sourceTable: tableName,
            sourceColumns: fk.columns,
            targetService,
            targetTable: fk.referencedTable,
            targetColumns: fk.referencedColumns,
            constraintName: fk.constraintName,
          });
        }
      }
    }

    return crossServiceFKs;
  }
}
