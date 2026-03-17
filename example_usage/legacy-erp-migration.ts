/**
 * Caso de uso real: Migración de un ERP Legacy COBOL a microservicios.
 *
 * Simula un sistema ERP legacy con módulos COBOL que acceden a una BD
 * PostgreSQL real, y ejecuta el pipeline completo del toolkit:
 *
 *  Fase 1 — Análisis estático del código legacy (Analyzer)
 *  Fase 2 — Conexión a BD real y validación (DbConnector + TableValidator)
 *  Fase 3 — Plan de descomposición en microservicios
 *  Fase 4 — Enriquecimiento con metadata real (PlanEnricher)
 *  Fase 5 — Generación de OpenAPI specs (API Generator)
 *  Fase 6 — Serialización y exportación de reportes
 *
 * Requisitos:
 *   - PostgreSQL corriendo con tablas reales
 *   - Variables de entorno configuradas (ver abajo)
 *
 * Ejecutar:
 *   export DB_HOST=localhost DB_PORT=5432 DB_NAME=erp_legacy DB_USER=postgres DB_PASSWORD=postgres
 *   npx tsx example_usage/legacy-erp-migration.ts
 */
import 'dotenv/config';

import {
  // Analyzer
  Analyzer,
  // DB Connector
  DbConnector,
  DbIntrospector,
  TableValidator,
  PlanEnricher,
  createAdapter,
  // API Generator
  EnrichedSchemaMapper,
  generateOpenApiFromEnrichedPlan,
  // Serializers
  AnalysisReportSerializer,
  DecompositionPlanSerializer,
  ValidationReportSerializer,
  // Errors
  ConnectionError,
  TableNotFoundError,
} from 'erp-modernization-toolkit';

import type {
  ConnectionConfig,
  DbDependencyMap,
  DecompositionPlan,
  AnalysisReport,
  EnrichedPlan,
} from 'erp-modernization-toolkit';

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuración ───────────────────────────────────────────────────────────

const config: ConnectionConfig = {
  databaseType: 'postgresql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  databaseName: process.env.DB_NAME ?? 'postgres',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
};

const schemaFilter = process.env.DB_SCHEMA ?? 'public';
const OUTPUT_DIR = path.join(process.cwd(), 'example_usage', 'output');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phase(num: number, title: string) {
  console.log(`\n${'━'.repeat(70)}`);
  console.log(`  FASE ${num}: ${title}`);
  console.log(`${'━'.repeat(70)}`);
}

function step(msg: string) {
  console.log(`  → ${msg}`);
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

function writeOutput(filename: string, content: string) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  ok(`Exportado: ${filePath}`);
}

// ─── Código Legacy Simulado ──────────────────────────────────────────────────
// En un caso real, el Analyzer escanearía archivos COBOL/RPG/etc. del disco.
// Aquí simulamos el resultado del análisis estático para poder ejercitar
// todo el pipeline sin necesitar archivos COBOL reales.

function buildSimulatedAnalysisReport(realTables: string[]): AnalysisReport {
  // Mapear tablas reales a módulos legacy ficticios
  const moduleMap: Record<string, { desc: string; tables: string[] }> = {};
  const serviceGroups = distributeTablesIntoServices(realTables);

  for (const [svcName, tables] of Object.entries(serviceGroups)) {
    moduleMap[svcName] = {
      desc: `Módulo legacy ${svcName}`,
      tables,
    };
  }

  // Construir módulos
  const modules = Object.entries(moduleMap).map(([name, { desc }], i) => ({
    path: `src/legacy/${name}.cbl`,
    language: 'cobol' as const,
    name,
    classes: [],
    functions: [
      { name: `PROC-${name.toUpperCase()}`, parameters: [], dependencies: [] },
    ],
    dependencies: [] as string[],
    lineCount: 200 + i * 100,
  }));

  // Construir referencias a BD
  const references: DbDependencyMap['references'] = Object.entries(moduleMap).flatMap(([name, { tables }]) =>
    tables.map((tableName) => ({
      moduleName: name,
      tableName,
      operation: 'read' as const,
      sourceLocation: { filePath: `src/legacy/${name}.cbl`, lineNumber: Math.floor(Math.random() * 200) + 1 },
      queryType: 'inline_sql' as const,
    })),
  );

  // Agregar referencias con operación 'write' (tablas ficticias obsoletas)
  references.push(
    {
      moduleName: 'facturacion',
      tableName: 'legacy_audit_log',
      operation: 'write',
      sourceLocation: { filePath: 'src/legacy/facturacion.cbl', lineNumber: 180 },
      queryType: 'inline_sql' as const,
    },
    {
      moduleName: 'inventario',
      tableName: 'tmp_stock_calc',
      operation: 'read',
      sourceLocation: { filePath: 'src/legacy/inventario.cbl', lineNumber: 95 },
      queryType: 'stored_procedure' as const,
    },
  );

  const nodes = modules.map((m) => ({
    id: m.name,
    name: m.name,
    type: 'module' as const,
  }));

  return {
    metadata: {
      projectPath: 'src/legacy',
      analyzedAt: new Date().toISOString(),
      toolkitVersion: '0.1.0',
      totalModules: modules.length,
      totalFiles: modules.length,
      supportedLanguages: ['cobol'],
    },
    modules,
    dependencyGraph: { nodes, edges: [] },
    metrics: modules.map((m) => ({
      moduleName: m.name,
      afferentCoupling: Math.floor(Math.random() * 5),
      efferentCoupling: Math.floor(Math.random() * 8),
      instability: Math.random(),
    })),
    dbDependencies: { references, unparsedQueries: [] },
    warnings: [],
  };
}

/**
 * Distribuye las tablas reales en grupos de servicios lógicos.
 * En un caso real, el Decomposer haría esto con algoritmos de clustering.
 */
function distributeTablesIntoServices(tables: string[]): Record<string, string[]> {
  const services: Record<string, string[]> = {};
  const serviceNames = ['clientes', 'pedidos', 'inventario', 'facturacion'];

  tables.forEach((table, i) => {
    const svcName = serviceNames[i % serviceNames.length];
    if (!services[svcName]) services[svcName] = [];
    services[svcName].push(table);
  });

  return services;
}

function buildDecompositionPlan(
  serviceGroups: Record<string, string[]>,
): DecompositionPlan {
  const services = Object.entries(serviceGroups).map(([name, tables], i) => ({
    name: `${name}-service`,
    description: `Microservicio de ${name} — migrado desde módulo COBOL legacy`,
    modules: [`src/legacy/${name}.cbl`],
    tables,
    riskLevel: (i === 0 ? 'low' : i === 1 ? 'medium' : 'high') as 'low' | 'medium' | 'high',
    externalDependencies: i > 0 ? [`${Object.keys(serviceGroups)[0]}-service`] : [],
  }));

  return {
    metadata: {
      createdAt: new Date().toISOString(),
      sourceReportId: 'analysis-legacy-001',
      toolkitVersion: '0.1.0',
      totalServices: services.length,
    },
    services,
    sharedTables: [],
    circularDependencies: [],
  };
}

// ─── Pipeline Principal ──────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     ERP LEGACY → MICROSERVICIOS: Pipeline de Migración Completo    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const connector = new DbConnector();

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // FASE 1: Conexión a la BD del sistema legacy
    // ═══════════════════════════════════════════════════════════════════════
    phase(1, 'Conexión a la base de datos del ERP legacy');

    step(`Conectando a ${config.databaseType}://${config.host}:${config.port}/${config.databaseName}...`);
    await connector.connect(config);
    ok(`Conexión establecida`);

    const adapter = connector.getAdapter();
    const healthy = await adapter.healthCheck();
    ok(`Health check: ${healthy ? 'PASS' : 'FAIL'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 2: Descubrimiento del esquema de BD
    // ═══════════════════════════════════════════════════════════════════════
    phase(2, 'Descubrimiento e introspección del esquema');

    const introspector = new DbIntrospector(adapter);
    const allTables = await introspector.listTables(schemaFilter);
    ok(`${allTables.length} tablas descubiertas en schema '${schemaFilter}'`);

    if (allTables.length === 0) {
      warn('No se encontraron tablas. Abortando.');
      await connector.disconnect();
      return;
    }

    // Introspección detallada
    step('Obteniendo esquemas detallados (batch)...');
    const schemas = await introspector.getMultipleTableSchemas(allTables, schemaFilter);
    let totalCols = 0;
    let totalFKs = 0;
    for (const [name, schema] of schemas) {
      if (schema) {
        totalCols += schema.columns.length;
        totalFKs += schema.foreignKeys.length;
        info(`${name}: ${schema.columns.length} cols, PK(${schema.primaryKey.columns.join(',') || '-'}), ${schema.foreignKeys.length} FKs`);
      }
    }
    ok(`Total: ${totalCols} columnas, ${totalFKs} foreign keys`);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 3: Análisis estático del código legacy (simulado)
    // ═══════════════════════════════════════════════════════════════════════
    phase(3, 'Análisis estático del código legacy');

    step('Analizando módulos COBOL...');
    const analysisReport = buildSimulatedAnalysisReport(allTables);
    ok(`${analysisReport.modules.length} módulos analizados`);
    ok(`${analysisReport.dbDependencies.references.length} referencias a BD detectadas`);
    ok(`${analysisReport.metrics.length} métricas calculadas`);

    for (const metric of analysisReport.metrics) {
      info(`${metric.moduleName}: acoplamiento aferente=${metric.afferentCoupling}, eferente=${metric.efferentCoupling}, inestabilidad=${metric.instability.toFixed(2)}`);
    }

    // Serializar reporte de análisis
    const analysisSerializer = new AnalysisReportSerializer();
    const analysisJson = analysisSerializer.serializePretty(analysisReport);
    writeOutput('01-analysis-report.json', analysisJson);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 4: Validación de dependencias contra BD real
    // ═══════════════════════════════════════════════════════════════════════
    phase(4, 'Validación de dependencias de BD');

    step('Comparando tablas referenciadas en código vs tablas reales...');
    const validator = new TableValidator(adapter, config);
    const validationReport = await validator.validate(analysisReport.dbDependencies, schemaFilter);

    ok(`Referencias totales: ${validationReport.summary.totalReferences}`);
    ok(`Tablas encontradas: ${validationReport.summary.foundCount}`);
    ok(`Tablas no encontradas: ${validationReport.summary.notFoundCount}`);

    const notFound = validationReport.results.filter((r) => r.status === 'not_found');
    if (notFound.length > 0) {
      warn('Tablas referenciadas en código que NO existen en la BD:');
      for (const r of notFound) {
        console.log(`      ❌ ${r.tableName} (refs: ${r.sourceReferences.length}, sugerencias: ${r.suggestions?.join(', ') || 'ninguna'})`);
      }
    }

    // Serializar reporte de validación
    const validationSerializer = new ValidationReportSerializer();
    const validationJson = validationSerializer.serializePretty(validationReport);
    writeOutput('02-validation-report.json', validationJson);

    // Verificar integridad del JSON
    const validResult = validationSerializer.validate(validationJson);
    ok(`Integridad del reporte: ${validResult.valid ? 'OK' : 'FALLIDA'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 5: Plan de descomposición en microservicios
    // ═══════════════════════════════════════════════════════════════════════
    phase(5, 'Plan de descomposición en microservicios');

    const serviceGroups = distributeTablesIntoServices(allTables);
    const plan = buildDecompositionPlan(serviceGroups);

    ok(`${plan.services.length} microservicios propuestos:`);
    for (const svc of plan.services) {
      info(`${svc.name} [${svc.riskLevel}]: ${svc.tables.length} tablas, deps: ${svc.externalDependencies.join(', ') || 'ninguna'}`);
    }

    // Serializar plan
    const planSerializer = new DecompositionPlanSerializer();
    const planJson = planSerializer.serializePretty(plan);
    writeOutput('03-decomposition-plan.json', planJson);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 6: Enriquecimiento con metadata real de BD
    // ═══════════════════════════════════════════════════════════════════════
    phase(6, 'Enriquecimiento del plan con esquemas reales');

    step('Obteniendo schemas reales para cada servicio...');
    const enricher = new PlanEnricher(introspector, config);
    const enrichedPlan: EnrichedPlan = await enricher.enrich(plan, schemaFilter);

    ok(`Enriquecido a las ${enrichedPlan.enrichment.enrichedAt}`);

    if (enrichedPlan.enrichment.unvalidatedTables.length > 0) {
      warn(`Tablas sin validar: ${enrichedPlan.enrichment.unvalidatedTables.join(', ')}`);
    }

    if (enrichedPlan.enrichment.crossServiceForeignKeys.length > 0) {
      ok(`${enrichedPlan.enrichment.crossServiceForeignKeys.length} foreign keys cross-service detectadas:`);
      for (const fk of enrichedPlan.enrichment.crossServiceForeignKeys) {
        info(`${fk.sourceService}.${fk.sourceTable}(${fk.sourceColumns}) → ${fk.targetService}.${fk.targetTable}(${fk.targetColumns})`);
      }
      warn('Estas FKs representan acoplamiento entre servicios — considerar eventos o API calls.');
    } else {
      ok('No se detectaron foreign keys cross-service');
    }

    for (const svc of enrichedPlan.enrichment.serviceSchemas) {
      info(`${svc.serviceName}: ${svc.tableSchemas.length} esquemas reales cargados`);
    }

    writeOutput('04-enriched-plan.json', JSON.stringify(enrichedPlan, null, 2));

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 7: Generación de OpenAPI specs para cada microservicio
    // ═══════════════════════════════════════════════════════════════════════
    phase(7, 'Generación de OpenAPI specs');

    step('Generando specs CRUD para cada servicio...');
    const mapper = new EnrichedSchemaMapper();
    const openApiSpecs = generateOpenApiFromEnrichedPlan(enrichedPlan, mapper);

    for (const spec of openApiSpecs) {
      const pathCount = Object.keys(spec.paths).length;
      const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;
      ok(`${spec.info.title}: ${pathCount} paths, ${schemaCount} schemas`);

      const filename = `05-openapi-${spec.info.title.replace(/\s+/g, '-').toLowerCase()}.json`;
      writeOutput(filename, JSON.stringify(spec, null, 2));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 8: Resumen y desconexión
    // ═══════════════════════════════════════════════════════════════════════
    phase(8, 'Resumen de la migración');

    console.log(`
  ┌─────────────────────────────────────────────────────────────────┐
  │  RESUMEN DEL ANÁLISIS DE MIGRACIÓN                             │
  ├─────────────────────────────────────────────────────────────────┤
  │  Tablas en BD:              ${String(allTables.length).padStart(5)}                             │
  │  Módulos legacy analizados: ${String(analysisReport.modules.length).padStart(5)}                             │
  │  Referencias a BD:          ${String(analysisReport.dbDependencies.references.length).padStart(5)}                             │
  │  Tablas validadas:          ${String(validationReport.summary.foundCount).padStart(5)}                             │
  │  Tablas no encontradas:     ${String(validationReport.summary.notFoundCount).padStart(5)}                             │
  │  Microservicios propuestos: ${String(plan.services.length).padStart(5)}                             │
  │  FKs cross-service:         ${String(enrichedPlan.enrichment.crossServiceForeignKeys.length).padStart(5)}                             │
  │  OpenAPI specs generadas:   ${String(openApiSpecs.length).padStart(5)}                             │
  └─────────────────────────────────────────────────────────────────┘`);

    step('Desconectando...');
    await connector.disconnect();
    ok('Desconectado');

    console.log(`\n  📁 Todos los reportes exportados en: ${OUTPUT_DIR}`);
    console.log('\n  🎉 Pipeline de migración completado con éxito\n');

  } catch (err) {
    if (err instanceof ConnectionError) {
      console.error(`\n  ❌ Error de conexión: ${err.message}`);
      console.error('     Verifica las variables de entorno DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    } else if (err instanceof TableNotFoundError) {
      console.error(`\n  ❌ Tabla no encontrada: ${err.message}`);
    } else {
      console.error('\n  ❌ Error inesperado:', err);
    }
    process.exit(1);
  } finally {
    if (connector.isConnected()) {
      await connector.disconnect();
    }
  }
}

main();
