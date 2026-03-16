# ERP Modernization Toolkit

Conjunto de herramientas para facilitar la modernización de sistemas ERP legacy. Analiza sistemas monolíticos existentes, planifica su descomposición en microservicios y genera especificaciones de APIs modernas (OpenAPI 3.x).

## Estado de Implementación

| Módulo | Estado |
|--------|--------|
| Analizador | ✅ Implementado |
| Serialización | ✅ Implementado |
| Descomponedor | 🔲 Pendiente |
| Generador API | 🔲 Pendiente |
| Exportador | 🔲 Pendiente |

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

## Módulos

- **Analizador** — Escanea código fuente legacy, construye grafos de dependencias y calcula métricas de complejidad (acoplamiento aferente/eferente, inestabilidad).
- **Descomponedor** — Identifica límites de contexto, evalúa riesgo por servicio y genera planes de descomposición con estrategias para tablas compartidas y dependencias circulares.
- **Generador API** — Produce especificaciones OpenAPI 3.x con endpoints CRUD, schemas derivados de tablas y códigos de respuesta HTTP estándar.
- **Exportador** — Empaqueta resultados en JSON, Markdown y SVG (grafo de dependencias con codificación de colores).

## Requisitos

- Node.js >= 18
- npm

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
│       └── index.ts           # Factory y re-exportaciones
├── decomposer/        # Descomposición en microservicios (pendiente)
├── api-generator/     # Generación de specs OpenAPI (pendiente)
├── exporter/          # Exportación JSON, Markdown, SVG (pendiente)
├── serialization/
│   ├── analysis-report.ts     # Serialización de AnalysisReport
│   └── decomposition-plan.ts  # Serialización de DecompositionPlan
├── models/
│   ├── types.ts       # Interfaces y tipos compartidos
│   └── errors.ts      # Jerarquía de errores tipados
└── index.ts           # Punto de entrada principal
tests/
├── unit/              # Tests unitarios (Vitest)
└── property/          # Tests basados en propiedades (fast-check)
```

## Uso

```typescript
import { Analyzer } from 'erp-modernization-toolkit';

const analyzer = new Analyzer();
const report = await analyzer.analyze('/ruta/a/proyecto-legacy');

console.log(`Módulos encontrados: ${report.modules.length}`);
console.log(`Nodos en grafo: ${report.dependencyGraph.nodes.length}`);
console.log(`Referencias BD: ${report.dbDependencies.references.length}`);
console.log(`Advertencias: ${report.warnings.length}`);
```

## Licencia

MIT

## Errores Tipados

El toolkit usa una jerarquía de errores para facilitar el manejo:

| Error | Descripción |
|-------|-------------|
| `InvalidPathError` | Ruta proporcionada no existe |
| `NoSourceFilesError` | No hay archivos fuente válidos |
| `SchemaValidationError` | JSON no cumple con el esquema |
| `JsonParseError` | JSON con sintaxis inválida |
| `InvalidReportError` | Reporte de análisis inválido |
| `InvalidPlanError` | Plan de descomposición inválido |
| `ExportIOError` | Error de escritura en disco |
