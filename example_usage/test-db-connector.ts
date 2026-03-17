/**
 * Prueba completa del db-connector contra una BD PostgreSQL real.
 *
 * Importa el framework como paquete npm (erp-modernization-toolkit) y ejercita:
 *  1. Conexión real y health check (DbConnector)
 *  2. Introspección de tablas y esquemas (DbIntrospector)
 *  3. Validación de dependencias simuladas vs BD real (TableValidator)
 *  4. Enriquecimiento de plan de descomposición (PlanEnricher)
 *  5. Serialización del reporte de validación (ValidationReportSerializer)
 *  6. Desconexión
 *
 * Configurar variables de entorno en el archivo .env antes de ejecutar:
 *   DB_HOST=localhost
 *   DB_PORT=5432
 *   DB_NAME=mi_base
 *   DB_USER=mi_usuario
 *   DB_PASSWORD=mi_password
 *   DB_SCHEMA=public          # opcional, default: public
 *
 * Ejecutar:
 *   npx tsx example_usage/test-db-connector.ts
 */

import 'dotenv/config';

import {
  DbConnector,
  DbIntrospector,
  TableValidator,
  PlanEnricher,
  ValidationReportSerializer,
  createAdapter,
  ConnectionError,
  TableNotFoundError,
  ConnectionLostError,
} from 'erp-modernization-toolkit';
import type {
  ConnectionConfig,
  DbDependencyMap,
  DecompositionPlan,
} from 'erp-modernization-toolkit';

// ─── Configuración desde variables de entorno ────────────────────────────────

const config: ConnectionConfig = {
  databaseType: 'postgresql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  databaseName: process.env.DB_NAME ?? 'postgres',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
};

const schemaFilter = process.env.DB_SCHEMA ?? 'public';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function header(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

function warn(msg: string) {
  console.log(`  ⚠️  ${msg}`);
}

async function expectError<T>(label: string, fn: () => Promise<T> | T, expectedType?: string): Promise<void> {
  try {
    await fn();
    warn(`${label}: NO lanzó error (se esperaba uno)`);
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : 'unknown';
    if (expectedType && name !== expectedType) {
      warn(`${label}: Lanzó ${name} en vez de ${expectedType}`);
    } else {
      ok(`${label}: Capturado ${name} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const connector = new DbConnector();

  // ── 1. Conexión y Health Check ──────────────────────────────────────────
  header('1. Conexión a PostgreSQL');
  console.log(`  → Conectando a ${config.host}:${config.port}/${config.databaseName}...`);
  await connector.connect(config);
  ok(`Conectado: ${connector.isConnected()}`);

  const adapter = connector.getAdapter();
  const healthy = await adapter.healthCheck();
  ok(`Health check: ${healthy ? 'OK' : 'FAIL'}`);

  // ── 2. Introspección ───────────────────────────────────────────────────
  header('2. Validación de config y manejo de errores');

  // 2a. Config inválida: host vacío
  await expectError('Config con host vacío', () => {
    const badConnector = new DbConnector();
    return badConnector.connect({ ...config, host: '' });
  }, 'ConnectionError');

  // 2b. Config inválida: puerto negativo
  await expectError('Config con puerto inválido', () => {
    const badConnector = new DbConnector();
    return badConnector.connect({ ...config, port: -1 });
  }, 'ConnectionError');

  // 2c. Config inválida: databaseType no soportado
  await expectError('Config con databaseType inválido', () => {
    const badConnector = new DbConnector();
    return badConnector.connect({ ...config, databaseType: 'sqlite' as any });
  }, 'ConnectionError');

  // 2d. getAdapter() sin conexión activa
  await expectError('getAdapter() sin conexión', () => {
    const freshConnector = new DbConnector();
    return freshConnector.getAdapter();
  }, 'ConnectionError');

  // 2e. createAdapter() factory
  header('2b. createAdapter() factory');
  const pgAdapter = createAdapter('postgresql');
  ok(`createAdapter('postgresql') → ${pgAdapter.constructor.name}`);
  const mysqlAdapter = createAdapter('mysql');
  ok(`createAdapter('mysql') → ${mysqlAdapter.constructor.name}`);
  const mssqlAdapter = createAdapter('mssql');
  ok(`createAdapter('mssql') → ${mssqlAdapter.constructor.name}`);
  const oracleAdapter = createAdapter('oracle');
  ok(`createAdapter('oracle') → ${oracleAdapter.constructor.name}`);
  const db2Adapter = createAdapter('db2');
  ok(`createAdapter('db2') → ${db2Adapter.constructor.name}`);

  // ── 3. Introspección ───────────────────────────────────────────────────
  header('3. Introspección de tablas');
  const introspector = new DbIntrospector(adapter);

  const tables = await introspector.listTables(schemaFilter);
  ok(`Tablas encontradas (${tables.length}): ${tables.join(', ')}`);

  if (tables.length === 0) {
    console.log('  ⚠️  No se encontraron tablas. Verifica el schema y la BD.');
    await connector.disconnect();
    return;
  }

  // Mostrar esquema de cada tabla (máximo 5 para no saturar la salida)
  const tablesToInspect = tables.slice(0, 5);
  for (const tableName of tablesToInspect) {
    const schema = await introspector.getTableSchema(tableName, schemaFilter);
    info(`${schema.tableName} (${schema.columns.length} cols, PK: ${schema.primaryKey.columns.join(',') || 'ninguna'}, FKs: ${schema.foreignKeys.length})`);
    for (const col of schema.columns) {
      console.log(`      - ${col.name}: ${col.dataType}${col.nullable ? '' : ' NOT NULL'}${col.isPrimaryKey ? ' [PK]' : ''}`);
    }
    for (const fk of schema.foreignKeys) {
      console.log(`      FK: ${fk.constraintName} (${fk.columns.join(',')}) → ${fk.referencedTable}(${fk.referencedColumns.join(',')})`);
    }
  }
  if (tables.length > 5) {
    info(`... y ${tables.length - 5} tablas más`);
  }

  // 3b. getMultipleTableSchemas (batch, incluyendo tabla inexistente)
  info('getMultipleTableSchemas (batch con tabla inexistente):');
  const batchNames = [...tables.slice(0, 2), 'tabla_fantasma_xyz'];
  const multiSchemas = await introspector.getMultipleTableSchemas(batchNames, schemaFilter);
  for (const [name, schema] of multiSchemas) {
    if (schema) {
      ok(`${name} → ${schema.columns.length} columnas`);
    } else {
      ok(`${name} → null (no encontrada, sin romper el batch)`);
    }
  }

  // 3c. TableNotFoundError al pedir schema de tabla inexistente
  await expectError(
    'getTableSchema con tabla inexistente (TableNotFoundError)',
    () => introspector.getTableSchema('tabla_fantasma_xyz', schemaFilter),
    'TableNotFoundError',
  );

  // ── 4. Validación de dependencias ──────────────────────────────────────
  header('4. Validación de dependencias de BD');

  // Simula dependencias: usa las primeras tablas reales + una ficticia
  const realTables = tables.slice(0, 3);
  const dbDeps: DbDependencyMap = {
    references: [
      ...realTables.map((t, i) => ({
        moduleName: `module_${i}`,
        tableName: t,
        operation: 'read' as const,
        sourceLocation: { filePath: `src/legacy/mod_${i}.cbl`, lineNumber: 10 * (i + 1) },
        queryType: 'inline_sql' as const,
      })),
      // Tabla ficticia que no debería existir
      {
        moduleName: 'module_ficticio',
        tableName: 'tabla_que_no_existe_xyz',
        operation: 'read' as const,
        sourceLocation: { filePath: 'src/legacy/ficticio.cbl', lineNumber: 99 },
        queryType: 'inline_sql' as const,
      },
    ],
    unparsedQueries: [],
  };

  const validator = new TableValidator(adapter, config);
  const validationReport = await validator.validate(dbDeps, schemaFilter);

  ok(`Total referencias: ${validationReport.summary.totalReferences}`);
  ok(`Encontradas: ${validationReport.summary.foundCount}`);
  ok(`No encontradas: ${validationReport.summary.notFoundCount}`);

  for (const result of validationReport.results) {
    if (result.status === 'found') {
      info(`${result.tableName} → ✅ encontrada en ${result.schemaLocation}`);
    } else {
      info(`${result.tableName} → ❌ no encontrada (sugerencias: ${result.suggestions?.join(', ') || 'ninguna'})`);
    }
  }

  // ── 5. Serialización del reporte ───────────────────────────────────────
  header('5. Serialización del reporte de validación');
  const serializer = new ValidationReportSerializer();

  // serialize() compacto
  const jsonCompact = serializer.serialize(validationReport);
  ok(`serialize() compacto: ${jsonCompact.length} chars`);

  // serializePretty()
  const json = serializer.serializePretty(validationReport);
  ok(`serializePretty(): ${json.length} chars`);

  const validation = serializer.validate(json);
  ok(`Validación del JSON: ${validation.valid ? 'VÁLIDO' : 'INVÁLIDO → ' + validation.errors.join(', ')}`);

  // validate() con JSON inválido
  const badValidation = serializer.validate('{"metadata": {}}');
  ok(`Validación de JSON incompleto: ${badValidation.valid ? 'VÁLIDO' : 'INVÁLIDO'} (${badValidation.errors.length} errores)`);

  const deserialized = serializer.deserialize(json);
  ok(`Deserialización OK: ${deserialized.results.length} resultados`);

  // ── 6. Enriquecimiento de plan de descomposición ───────────────────────
  header('6. Enriquecimiento de plan de descomposición');

  // Construye un plan usando las tablas reales de la BD
  const half = Math.ceil(realTables.length / 2);
  const plan: DecompositionPlan = {
    metadata: {
      createdAt: new Date().toISOString(),
      sourceReportId: 'live-test-001',
      toolkitVersion: '0.1.0',
      totalServices: 2,
    },
    services: [
      {
        name: 'service-a',
        description: 'Primer grupo de tablas',
        modules: ['src/legacy/group_a.cbl'],
        tables: realTables.slice(0, half),
        riskLevel: 'low',
        externalDependencies: [],
      },
      {
        name: 'service-b',
        description: 'Segundo grupo de tablas',
        modules: ['src/legacy/group_b.cbl'],
        tables: realTables.slice(half),
        riskLevel: 'medium',
        externalDependencies: ['service-a'],
      },
    ],
    sharedTables: [],
    circularDependencies: [],
  };

  const enricher = new PlanEnricher(introspector, config);
  const enrichedPlan = await enricher.enrich(plan, schemaFilter);

  ok(`Plan enriquecido a las ${enrichedPlan.enrichment.enrichedAt}`);
  ok(`Tipo de BD: ${enrichedPlan.enrichment.databaseType}`);
  ok(`Tablas no validadas: ${enrichedPlan.enrichment.unvalidatedTables.join(', ') || 'ninguna'}`);
  ok(`Foreign keys cross-service: ${enrichedPlan.enrichment.crossServiceForeignKeys.length}`);

  for (const fk of enrichedPlan.enrichment.crossServiceForeignKeys) {
    info(`${fk.sourceService}.${fk.sourceTable}(${fk.sourceColumns.join(',')}) → ${fk.targetService}.${fk.targetTable}(${fk.targetColumns.join(',')})`);
  }

  for (const svc of enrichedPlan.enrichment.serviceSchemas) {
    info(`${svc.serviceName}: ${svc.tableSchemas.length} esquemas cargados`);
  }

  // ── 7. Desconexión ────────────────────────────────────────────────────
  header('7. Desconexión');
  await connector.disconnect();
  ok(`Conectado: ${connector.isConnected()}`);

  // ConnectionLostError: intentar usar adapter después de desconectar
  await expectError(
    'Usar adapter después de desconectar (ConnectionLostError)',
    () => adapter.getTableNames(),
    'ConnectionLostError',
  );
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  🎉 Prueba completa finalizada con éxito');
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
