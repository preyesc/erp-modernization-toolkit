# ERP Modernization Toolkit

Conjunto de herramientas para facilitar la modernización de sistemas ERP legacy. Analiza sistemas monolíticos existentes, planifica su descomposición en microservicios, valida dependencias contra bases de datos reales, enriquece planes con metadata de BD y genera especificaciones de APIs modernas (OpenAPI 3.x).

## Estado de Implementación

| Módulo | Estado |
|--------|--------|
| Analizador | ✅ Implementado |
| Conector de BD | ✅ Implementado |
| Generador API | ✅ Implementado |
| Serialización | ✅ Implementado |
| Descomponedor | 🔲 Pendiente |
| Exportador | 🔲 Pendiente |

## Pipeline de Modernización

```
Código Legacy → Analizador → AnalysisReport
                                   ↓
                    Conector BD → Validación + Introspección
                                   ↓
                            DecompositionPlan
                                   ↓
                    PlanEnricher → EnrichedPlan (con schemas reales)
                                   ↓
                    Generador API → OpenAPI 3.x Specs (por servicio)
```

## Lenguajes Legacy Soportados

| Lenguaje | Extensiones |
|----------|------------|
| DataFlex | `.src`, `.pkg`, `.wo`, `.dg`, `.rv`, `.sl`, `.vw` |
| COBOL | `.cbl`, `.cob`, `.cpy` |
| ABAP | `.abap`, `.fugr`, `.prog`, `.clas` |
| RPG (AS/400) | `.rpg`, `.rpgle`, `.sqlrpgle` |
| Progress 4GL | `.p`, `.w`, `.i`, `.cls` |
| PL/SQL | `.sql`, `.pls`, `.plb`, `.pck` |
| Visual FoxPro | `.prg`, `.scx`, `.vcx`, `.frx` |
| Delphi | `.pas`, `.dpr`, `.dfm` |
| PowerBuilder | `.pbl`, `.pbt`, `.srw`, `.srd` |
| Natural | `.nsp`, `.nsn`, `.nss` |
| Pick/BASIC | `.bp`, `.b` |
| PHP | `.php`, `.phtml`, `.php5`, `.php7`, `.inc` |

## Bases de Datos Soportadas

| Base de Datos | Adaptador |
|---------------|-----------|
| PostgreSQL | `PostgresAdapter` |
| MySQL | `MysqlAdapter` |
| SQL Server | `MssqlAdapter` |
| Oracle | `OracleAdapter` |
| DB2 | `Db2Adapter` |

## Módulos

- **Analizador** — Escanea código fuente legacy, construye grafos de dependencias y calcula métricas de complejidad (acoplamiento aferente/eferente, inestabilidad).
- **Conector de BD** — Conecta a bases de datos reales, introspecciona esquemas, valida dependencias detectadas en código contra tablas existentes (con sugerencias fuzzy para tablas no encontradas), y enriquece planes de descomposición con metadata real.
- **Generador API** — Produce especificaciones OpenAPI 3.x con endpoints CRUD, schemas derivados de columnas reales de BD, parámetros tipados según primary keys, y fallback a schemas inferidos para tablas no validadas.
- **Descomponedor** — Identifica límites de contexto, evalúa riesgo por servicio y genera planes de descomposición con estrategias para tablas compartidas y dependencias circulares. *(Pendiente de implementación)*
- **Exportador** — Empaqueta resultados en JSON, Markdown y SVG (grafo de dependencias con codificación de colores). *(Pendiente de implementación)*

## Documentación

La documentación técnica completa está en [`docs/`](./docs/):

- [Guía de Uso](./docs/usage.md) — API, ejemplos y componentes individuales
- [Arquitectura](./docs/architecture.md) — Diseño del sistema y decisiones
- [Diagramas de Secuencia](./docs/sequences.md) — Flujos de ejecución detallados
- [Patrones de Diseño](./docs/patterns.md) — Patrones aplicados en la implementación

## Requisitos

- Node.js >= 18
- npm
- Base de datos accesible (para funcionalidades de Conector BD)

## Instalación

```bash
npm install
```

## Scripts

```bash
npm run build    # Compilar TypeScript
npm test         # Ejecutar tests (Vitest + fast-check)
```

## Estructura del Proyecto

```
src/
├── analyzer/
│   ├── index.ts              # Orquestador del Analizador
│   ├── scanner.ts            # Escaneo de código fuente multi-lenguaje
│   ├── db-detector.ts        # Detección de dependencias de BD
│   ├── metrics.ts            # Cálculo de métricas (Ca, Ce, Inestabilidad)
│   ├── graph-builder.ts      # Construcción del grafo de dependencias
│   └── parsers/
│       ├── parser-registry.ts # Registro dinámico de parsers
│       ├── base-parser.ts     # Utilidades compartidas de parseo
│       ├── dataflex.ts        # Parser DataFlex
│       ├── cobol.ts           # Parser COBOL
│       ├── abap.ts            # Parser ABAP
│       ├── rpg.ts             # Parser RPG
│       ├── progress4gl.ts     # Parser Progress 4GL
│       ├── plsql.ts           # Parser PL/SQL
│       ├── foxpro.ts          # Parser Visual FoxPro
│       ├── delphi.ts          # Parser Delphi
│       ├── powerbuilder.ts    # Parser PowerBuilder
│       ├── natural.ts         # Parser Natural
│       ├── pickbasic.ts       # Parser Pick/BASIC
│       ├── php.ts             # Parser PHP
│       └── index.ts           # Factory y re-exportaciones
├── db-connector/
│   ├── index.ts               # DbConnector — gestión de conexiones
│   ├── introspector.ts        # DbIntrospector — introspección de esquemas
│   ├── validator.ts           # TableValidator — validación contra BD real
│   ├── enricher.ts            # PlanEnricher — enriquecimiento de planes
│   ├── levenshtein.ts         # Distancia Levenshtein para sugerencias fuzzy
│   └── adapters/
│       ├── types.ts           # Factory de adaptadores
│       ├── base-adapter.ts    # Clase base para adaptadores
│       ├── postgres.ts        # Adaptador PostgreSQL
│       ├── mysql.ts           # Adaptador MySQL
│       ├── mssql.ts           # Adaptador SQL Server
│       ├── oracle.ts          # Adaptador Oracle
│       └── db2.ts             # Adaptador DB2
├── api-generator/
│   └── index.ts               # EnrichedSchemaMapper + generación OpenAPI
├── decomposer/                # Descomposición en microservicios (pendiente)
├── exporter/                  # Exportación JSON, Markdown, SVG (pendiente)
├── serialization/
│   ├── analysis-report.ts     # Serialización de AnalysisReport
│   ├── decomposition-plan.ts  # Serialización de DecompositionPlan
│   └── validation-report.ts   # Serialización de ValidationReport
├── models/
│   ├── types.ts               # Interfaces y tipos compartidos
│   └── errors.ts              # Jerarquía de errores tipados
└── index.ts                   # Punto de entrada principal
tests/
├── unit/                      # Tests unitarios (Vitest)
└── property/                  # Tests basados en propiedades (fast-check)
```

## Uso Rápido

### Análisis de Código Legacy

```typescript
import { Analyzer } from 'erp-modernization-toolkit';

const analyzer = new Analyzer();
const report = await analyzer.analyze('/ruta/a/proyecto-legacy');

console.log(`Módulos encontrados: ${report.modules.length}`);
console.log(`Nodos en grafo: ${report.dependencyGraph.nodes.length}`);
console.log(`Referencias BD: ${report.dbDependencies.references.length}`);
```

### Conexión a BD y Validación

```typescript
import { DbConnector, DbIntrospector, TableValidator } from 'erp-modernization-toolkit';

const connector = new DbConnector();
await connector.connect({
  databaseType: 'postgresql',
  host: 'localhost',
  port: 5432,
  databaseName: 'erp_legacy',
  username: '[user]',
  password: '[password]',
});

const adapter = connector.getAdapter();
const introspector = new DbIntrospector(adapter);
const tables = await introspector.listTables('public');

// Validar dependencias detectadas contra BD real
const validator = new TableValidator(adapter, config);
const validationReport = await validator.validate(report.dbDependencies, 'public');
```

### Enriquecimiento y Generación de APIs

```typescript
import { PlanEnricher, EnrichedSchemaMapper, generateOpenApiFromEnrichedPlan } from 'erp-modernization-toolkit';

// Enriquecer plan con schemas reales de BD
const enricher = new PlanEnricher(introspector, config);
const enrichedPlan = await enricher.enrich(decompositionPlan, 'public');

// Generar OpenAPI specs por microservicio
const mapper = new EnrichedSchemaMapper();
const openApiSpecs = generateOpenApiFromEnrichedPlan(enrichedPlan, mapper);
```

## Errores Tipados

El toolkit usa una jerarquía de errores para facilitar el manejo:

| Error | Código | Descripción |
|-------|--------|-------------|
| `InvalidPathError` | `INVALID_PATH` | Ruta proporcionada no existe |
| `NoSourceFilesError` | `NO_SOURCE_FILES` | No hay archivos fuente válidos |
| `SchemaValidationError` | `SCHEMA_VALIDATION` | JSON no cumple con el esquema |
| `JsonParseError` | `JSON_PARSE` | JSON con sintaxis inválida |
| `InvalidReportError` | `INVALID_REPORT` | Reporte de análisis inválido |
| `InvalidPlanError` | `INVALID_PLAN` | Plan de descomposición inválido |
| `ExportIOError` | `EXPORT_IO` | Error de escritura en disco |
| `ConnectionError` | `DB_CONNECTION` | Fallo de conexión a BD |
| `ConnectionLostError` | `DB_CONNECTION_LOST` | Conexión perdida durante operación |
| `TableNotFoundError` | `TABLE_NOT_FOUND` | Tabla no encontrada en BD |
| `IntrospectionError` | `INTROSPECTION` | Fallo al introspeccionar tabla |

## Licencia

[MIT](./LICENSE)
