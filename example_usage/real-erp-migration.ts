/**
 * Pipeline REAL de migración: Código fuente real + Base de datos real.
 *
 * A diferencia de legacy-erp-migration.ts (que simula el análisis),
 * este script ejecuta el Analyzer REAL contra un directorio de código
 * fuente legacy y conecta a una BD real para validar, enriquecer y
 * generar OpenAPI specs.
 *
 * Uso:
 *   npx tsx example_usage/real-erp-migration.ts <ruta-codigo-legacy>
 *
 * Variables de entorno (o .env):
 *   DB_TYPE     — postgresql | mysql | mssql | oracle | db2 (default: postgresql)
 *   DB_HOST     — Host de la BD (default: localhost)
 *   DB_PORT     — Puerto (default: 5432)
 *   DB_NAME     — Nombre de la BD
 *   DB_USER     — Usuario
 *   DB_PASSWORD — Contraseña
 *   DB_SCHEMA   — Schema a filtrar (default: public)
 *
 * Ejemplo:
 *   DB_HOST=localhost DB_NAME=erp_legacy DB_USER=postgres DB_PASSWORD=secret \
 *     npx tsx example_usage/real-erp-migration.ts /ruta/a/codigo-legacy
 */
import 'dotenv/config';

import {
  Analyzer,
  DbConnector,
  DbIntrospector,
  TableValidator,
  PlanEnricher,
  EnrichedSchemaMapper,
  generateOpenApiFromEnrichedPlan,
  AnalysisReportSerializer,
  DecompositionPlanSerializer,
  ValidationReportSerializer,
  ConnectionError,
  TableNotFoundError,
} from 'erp-modernization-toolkit';

import type {
  ConnectionConfig,
  DatabaseType,
  DecompositionPlan,
  EnrichedPlan,
} from 'erp-modernization-toolkit';

import * as fs from 'fs';
import * as path from 'path';

// ─── Argumentos CLI ──────────────────────────────────────────────────────────

const SOURCE_PATH = process.argv[2];

if (!SOURCE_PATH) {
  console.error(`
  Uso: npx tsx example_usage/real-erp-migration.ts <ruta-codigo-legacy>

  Ejemplo:
    npx tsx example_usage/real-erp-migration.ts ./mi-proyecto-cobol

  Asegúrate de configurar las variables de entorno de BD (o usar .env).
  `);
  process.exit(1);
}

const resolvedPath = path.resolve(SOURCE_PATH);

if (!fs.existsSync(resolvedPath)) {
  console.error(`\n  ❌ La ruta no existe: ${resolvedPath}\n`);
  process.exit(1);
}

// ─── Configuración de BD ─────────────────────────────────────────────────────

const dbType = (process.env.DB_TYPE ?? 'postgresql') as DatabaseType;

const config: ConnectionConfig = {
  databaseType: dbType,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  databaseName: process.env.DB_NAME ?? 'postgres',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
};

const schemaFilter = process.env.DB_SCHEMA ?? 'public';
const OUTPUT_DIR = path.join(process.cwd(), 'example_usage', 'output', 'real');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phase(num: number, title: string) {
  console.log(`\n${'━'.repeat(70)}`);
  console.log(`  FASE ${num}: ${title}`);
  console.log(`${'━'.repeat(70)}`);
}

function step(msg: string) { console.log(`  → ${msg}`); }
function ok(msg: string)   { console.log(`  ✅ ${msg}`); }
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }

function writeOutput(filename: string, content: string) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  ok(`Exportado: ${filePath}`);
}

/**
 * Agrupa tablas en servicios basándose en las dependencias reales
 * detectadas por el Analyzer. Tablas accedidas por el mismo módulo
 * se agrupan en el mismo servicio.
 */
function groupTablesIntoServices(
  modules: { name: string }[],
  references: { moduleName: string; tableName: string }[],
): Record<string, string[]> {
  const services: Record<string, Set<string>> = {};

  // Agrupar tablas por módulo que las referencia
  for (const ref of references) {
    if (!services[ref.moduleName]) {
      services[ref.moduleName] = new Set();
    }
    services[ref.moduleName].add(ref.tableName);
  }

  // Módulos sin referencias a BD obtienen un servicio vacío
  for (const mod of modules) {
    if (!services[mod.name]) {
      services[mod.name] = new Set();
    }
  }

  // Convertir Sets a arrays
  const result: Record<string, string[]> = {};
  for (const [name, tables] of Object.entries(services)) {
    result[name] = [...tables];
  }
  return result;
}

function buildDecompositionPlan(
  serviceGroups: Record<string, string[]>,
  allServiceNames: string[],
): DecompositionPlan {
  const services = Object.entries(serviceGroups).map(([name, tables], i) => ({
    name: `${name}-service`,
    description: `Microservicio migrado desde módulo legacy: ${name}`,
    modules: [name],
    tables,
    riskLevel: (tables.length <= 2 ? 'low' : tables.length <= 5 ? 'medium' : 'high') as 'low' | 'medium' | 'high',
    externalDependencies: allServiceNames
      .filter(n => n !== name)
      .slice(0, 2)
      .map(n => `${n}-service`),
  }));

  return {
    metadata: {
      createdAt: new Date().toISOString(),
      sourceReportId: 'real-analysis-001',
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
  console.log('║   MIGRACIÓN REAL: Código Fuente + Base de Datos → Microservicios   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  Código fuente: ${resolvedPath}`);
  console.log(`  Base de datos: ${config.databaseType}://${config.host}:${config.port}/${config.databaseName}`);
  console.log(`  Schema:        ${schemaFilter}`);

  const connector = new DbConnector();

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // FASE 1: Análisis estático REAL del código fuente
    // ═══════════════════════════════════════════════════════════════════════
    phase(1, 'Análisis estático del código fuente');

    step(`Escaneando: ${resolvedPath}`);
    const analyzer = new Analyzer();
    const analysisReport = await analyzer.analyze(resolvedPath);

    ok(`${analysisReport.modules.length} módulos detectados`);
    ok(`${analysisReport.dependencyGraph.nodes.length} nodos en el grafo`);
    ok(`${analysisReport.dependencyGraph.edges.length} aristas en el grafo`);
    ok(`${analysisReport.dbDependencies.references.length} referencias a BD`);
    ok(`${analysisReport.metrics.length} métricas calculadas`);

    if (analysisReport.warnings.length > 0) {
      warn(`${analysisReport.warnings.length} advertencias:`);
      for (const w of analysisReport.warnings.slice(0, 10)) {
        console.log(`      ⚠️  [${w.type}] ${w.message}`);
      }
      if (analysisReport.warnings.length > 10) {
        console.log(`      ... y ${analysisReport.warnings.length - 10} más`);
      }
    }

    // Mostrar lenguajes detectados
    const languages = new Set(analysisReport.modules.map((m: { language: string }) => m.language));
    info(`Lenguajes detectados: ${[...languages].join(', ')}`);

    // Mostrar métricas
    for (const metric of analysisReport.metrics) {
      info(`${metric.moduleName}: Ca=${metric.afferentCoupling}, Ce=${metric.efferentCoupling}, I=${metric.instability.toFixed(2)}`);
    }

    // Mostrar referencias a BD
    if (analysisReport.dbDependencies.references.length > 0) {
      step('Referencias a BD detectadas:');
      const tableSet = new Set(analysisReport.dbDependencies.references.map((r: { tableName: string }) => r.tableName));
      info(`${tableSet.size} tablas únicas referenciadas: ${[...tableSet].slice(0, 15).join(', ')}${tableSet.size > 15 ? '...' : ''}`);
    }

    if (analysisReport.dbDependencies.unparsedQueries.length > 0) {
      warn(`${analysisReport.dbDependencies.unparsedQueries.length} consultas SQL dinámicas no parseables`);
    }

    // Serializar reporte
    const analysisSerializer = new AnalysisReportSerializer();
    writeOutput('01-analysis-report.json', analysisSerializer.serializePretty(analysisReport));

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 2: Conexión a la BD real
    // ═══════════════════════════════════════════════════════════════════════
    phase(2, 'Conexión a la base de datos');

    step(`Conectando a ${config.databaseType}://${config.host}:${config.port}/${config.databaseName}...`);
    await connector.connect(config);
    ok('Conexión establecida');

    const adapter = connector.getAdapter();
    const healthy = await adapter.healthCheck();
    ok(`Health check: ${healthy ? 'PASS' : 'FAIL'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 3: Descubrimiento e introspección del esquema
    // ═══════════════════════════════════════════════════════════════════════
    phase(3, 'Descubrimiento e introspección del esquema');

    const introspector = new DbIntrospector(adapter);
    const allTables = await introspector.listTables(schemaFilter);
    ok(`${allTables.length} tablas descubiertas en schema '${schemaFilter}'`);

    if (allTables.length === 0) {
      warn('No se encontraron tablas en la BD. El pipeline continuará sin validación de BD.');
    }

    // Introspección detallada
    if (allTables.length > 0) {
      step('Obteniendo esquemas detallados...');
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
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 4: Validación de dependencias contra BD real
    // ═══════════════════════════════════════════════════════════════════════
    phase(4, 'Validación de dependencias de BD');

    step('Comparando tablas referenciadas en código vs tablas reales...');
    const validator = new TableValidator(adapter, config);
    const validationReport = await validator.validate(analysisReport.dbDependencies, schemaFilter);

    ok(`Referencias totales: ${validationReport.summary.totalReferences}`);
    ok(`Tablas encontradas:  ${validationReport.summary.foundCount}`);
    ok(`Tablas no encontradas: ${validationReport.summary.notFoundCount}`);

    const notFound = validationReport.results.filter((r: { status: string }) => r.status === 'not_found');
    if (notFound.length > 0) {
      warn('Tablas referenciadas en código que NO existen en la BD:');
      for (const r of notFound) {
        console.log(`      ❌ ${r.tableName} (refs: ${r.sourceReferences.length}, sugerencias: ${r.suggestions?.join(', ') || 'ninguna'})`);
      }
    }

    const validationSerializer = new ValidationReportSerializer();
    writeOutput('02-validation-report.json', validationSerializer.serializePretty(validationReport));

    const validResult = validationSerializer.validate(validationSerializer.serializePretty(validationReport));
    ok(`Integridad del reporte: ${validResult.valid ? 'OK' : 'FALLIDA'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // FASE 5: Plan de descomposición en microservicios
    // ═══════════════════════════════════════════════════════════════════════
    phase(5, 'Plan de descomposición en microservicios');

    step('Agrupando tablas por módulo que las referencia...');
    const serviceGroups = groupTablesIntoServices(
      analysisReport.modules,
      analysisReport.dbDependencies.references,
    );
    const allServiceNames = Object.keys(serviceGroups);
    const plan = buildDecompositionPlan(serviceGroups, allServiceNames);

    ok(`${plan.services.length} microservicios propuestos:`);
    for (const svc of plan.services) {
      info(`${svc.name} [${svc.riskLevel}]: ${svc.tables.length} tablas, deps: ${svc.externalDependencies.join(', ') || 'ninguna'}`);
    }

    const planSerializer = new DecompositionPlanSerializer();
    writeOutput('03-decomposition-plan.json', planSerializer.serializePretty(plan));

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
    // FASE 7: Generación de OpenAPI specs
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
    // FASE 8: Resumen
    // ═══════════════════════════════════════════════════════════════════════
    phase(8, 'Resumen de la migración');

    const referencedTables = new Set(analysisReport.dbDependencies.references.map((r: { tableName: string }) => r.tableName));

    console.log(`
  ┌─────────────────────────────────────────────────────────────────┐
  │  RESUMEN DEL ANÁLISIS DE MIGRACIÓN (REAL)                      │
  ├─────────────────────────────────────────────────────────────────┤
  │  Código fuente:             ${resolvedPath.slice(-35).padStart(35)}  │
  │  Lenguajes detectados:      ${String([...languages].join(', ')).slice(0, 35).padStart(35)}  │
  │  Módulos analizados:        ${String(analysisReport.modules.length).padStart(5)}                              │
  │  Líneas de código:          ${String(analysisReport.modules.reduce((s: number, m: { lineCount: number }) => s + m.lineCount, 0)).padStart(5)}                              │
  │  Nodos en grafo:            ${String(analysisReport.dependencyGraph.nodes.length).padStart(5)}                              │
  │  Aristas en grafo:          ${String(analysisReport.dependencyGraph.edges.length).padStart(5)}                              │
  │  Tablas en BD:              ${String(allTables.length).padStart(5)}                              │
  │  Tablas referenciadas:      ${String(referencedTables.size).padStart(5)}                              │
  │  Tablas validadas:          ${String(validationReport.summary.foundCount).padStart(5)}                              │
  │  Tablas no encontradas:     ${String(validationReport.summary.notFoundCount).padStart(5)}                              │
  │  Microservicios propuestos: ${String(plan.services.length).padStart(5)}                              │
  │  FKs cross-service:         ${String(enrichedPlan.enrichment.crossServiceForeignKeys.length).padStart(5)}                              │
  │  OpenAPI specs generadas:   ${String(openApiSpecs.length).padStart(5)}                              │
  │  Advertencias:              ${String(analysisReport.warnings.length).padStart(5)}                              │
  └─────────────────────────────────────────────────────────────────┘`);

    step('Desconectando...');
    await connector.disconnect();
    ok('Desconectado');

    console.log(`\n  📁 Reportes exportados en: ${OUTPUT_DIR}`);
    console.log('\n  🎉 Pipeline de migración REAL completado con éxito\n');

  } catch (err: unknown) {
    if (err instanceof ConnectionError) {
      console.error(`\n  ❌ Error de conexión: ${(err as Error).message}`);
      console.error('     Verifica las variables de entorno DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    } else if (err instanceof TableNotFoundError) {
      console.error(`\n  ❌ Tabla no encontrada: ${(err as Error).message}`);
    } else if (err instanceof Error) {
      console.error(`\n  ❌ Error inesperado: ${err.message}`);
    } else {
      console.error('\n  ❌ Error inesperado:', String(err));
    }
    process.exit(1);
  } finally {
    if (connector.isConnected()) {
      await connector.disconnect();
    }
  }
}

main();
