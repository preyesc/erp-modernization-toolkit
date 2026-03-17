# Documentación del ERP Modernization Toolkit

Bienvenido a la documentación técnica del ERP Modernization Toolkit.

## Índice

| Documento | Descripción |
|-----------|-------------|
| [Guía de Uso](./usage.md) | Cómo usar el toolkit, ejemplos y API |
| [Arquitectura](./architecture.md) | Diseño del sistema, componentes y decisiones |
| [Diagramas de Secuencia](./sequences.md) | Flujos de ejecución detallados |
| [Patrones de Diseño](./patterns.md) | Patrones aplicados en la implementación |

## Inicio Rápido

```typescript
import {
  Analyzer,
  DbConnector,
  DbIntrospector,
  TableValidator,
  PlanEnricher,
  EnrichedSchemaMapper,
  generateOpenApiFromEnrichedPlan,
} from 'erp-modernization-toolkit';

// 1. Analizar código legacy
const analyzer = new Analyzer();
const report = await analyzer.analyze('/ruta/proyecto-legacy');

// 2. Conectar a BD y validar dependencias
const connector = new DbConnector();
await connector.connect(config);
const adapter = connector.getAdapter();
const introspector = new DbIntrospector(adapter);
const validator = new TableValidator(adapter, config);
const validationReport = await validator.validate(report.dbDependencies, 'public');

// 3. Enriquecer plan con schemas reales
const enricher = new PlanEnricher(introspector, config);
const enrichedPlan = await enricher.enrich(plan, 'public');

// 4. Generar OpenAPI specs por microservicio
const specs = generateOpenApiFromEnrichedPlan(enrichedPlan);
```

## Lenguajes Soportados

El toolkit analiza código fuente en 12 lenguajes legacy ERP:

- DataFlex, COBOL, ABAP, RPG, Progress 4GL
- PL/SQL, Visual FoxPro, Delphi, PowerBuilder
- Natural, Pick/BASIC, PHP, PHP

## Bases de Datos Soportadas

- PostgreSQL, MySQL, SQL Server, Oracle, DB2

## Módulos del Sistema

```mermaid
graph LR
    A[Analizador] --> V[Conector BD]
    V --> B[Descomponedor]
    B --> E[Enriquecedor]
    E --> C[Generador API]
    C --> D[Exportador]
    
    style A fill:#10B981
    style V fill:#10B981
    style E fill:#10B981
    style C fill:#10B981
    style B fill:#6B7280
    style D fill:#6B7280
```

- 🟢 **Analizador** — Implementado
- 🟢 **Conector de BD** — Implementado (conexión, introspección, validación, enriquecimiento)
- 🟢 **Generador API** — Implementado (OpenAPI 3.x desde planes enriquecidos)
- 🟢 **Serialización** — Implementado (AnalysisReport, DecompositionPlan, ValidationReport)
- ⬜ **Descomponedor** — Pendiente (interfaces definidas)
- ⬜ **Exportador** — Pendiente
