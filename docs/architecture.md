# Arquitectura

## Visión General del Sistema

El ERP Modernization Toolkit es un pipeline de múltiples etapas que transforma código legacy en artefactos de modernización.

```mermaid
graph TD
    INPUT[Código Fuente Legacy] --> ANALYZER[Analizador]
    ANALYZER --> REPORT[AnalysisReport JSON]
    REPORT --> DBCONN[Conector BD]
    DBCONN --> VALREPORT[ValidationReport JSON]
    REPORT --> DECOMPOSER[Descomponedor]
    DECOMPOSER --> PLAN[DecompositionPlan JSON]
    PLAN --> ENRICHER[PlanEnricher]
    DBCONN --> ENRICHER
    ENRICHER --> EPLAN[EnrichedPlan JSON]
    EPLAN --> APIGEN[Generador API]
    APIGEN --> SPECS[OpenAPI Specs]
    REPORT --> EXPORTER[Exportador]
    PLAN --> EXPORTER
    SPECS --> EXPORTER
    EXPORTER --> OUTPUT[JSON + Markdown + SVG]

    style ANALYZER fill:#10B981,color:#fff
    style DBCONN fill:#10B981,color:#fff
    style ENRICHER fill:#10B981,color:#fff
    style APIGEN fill:#10B981,color:#fff
    style REPORT fill:#3B82F6,color:#fff
    style VALREPORT fill:#3B82F6,color:#fff
    style PLAN fill:#3B82F6,color:#fff
    style EPLAN fill:#3B82F6,color:#fff
    style SPECS fill:#3B82F6,color:#fff
```

## Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| TypeScript | Tipado estático, soporte JSON nativo, ecosistema de análisis |
| Interfaces por componente | Desacoplamiento, testabilidad, extensibilidad |
| JSON como formato de intercambio | Estándar, validable con JSON Schema |
| Plugin registry para parsers | Agregar lenguajes sin modificar código existente |
| Adapter pattern para BD | Soportar múltiples motores con interfaz unificada |
| Enriquecimiento aditivo | El plan original se preserva intacto, la metadata de BD se agrega |
| SVG programático | Sin dependencias de renderizado externo |

## Arquitectura del Analizador

El Analizador es el módulo más complejo. Orquesta cuatro sub-componentes:

```mermaid
graph TD
    A[Analyzer] --> S[CodeScanner]
    A --> D[DbDependencyDetector]
    A --> G[GraphBuilder]
    A --> M[MetricsCalculator]

    S --> PR[ParserRegistry]
    D --> PR

    PR --> P1[DataFlexParser]
    PR --> P2[CobolParser]
    PR --> P3[AbapParser]
    PR --> P4[RpgParser]
    PR --> P5[Progress4glParser]
    PR --> P6[PlsqlParser]
    PR --> P7[FoxproParser]
    PR --> P8[DelphiParser]
    PR --> P9[PowerBuilderParser]
    PR --> P10[NaturalParser]
    PR --> P11[PickBasicParser]
    PR --> P12[PhpParser]

    S -->|ModuleInfo[]| A
    D -->|DbDependencyMap| A
    G -->|DependencyGraph| A
    M -->|ModuleMetrics[]| A
```

### Componentes del Analizador

#### ParserRegistry

Registro dinámico que mapea extensiones de archivo a parsers. Cada parser implementa `ILanguageParser`:

```typescript
interface ILanguageParser {
  languageName: string;
  fileExtensions: string[];
  parseFile(filePath: string, content: string): ModuleInfo;
  detectDbAccess(content: string, filePath: string): DbReference[];
}
```

#### CodeScanner

Recorre el sistema de archivos recursivamente, delega el parseo al parser correcto según la extensión, y genera advertencias para archivos no soportados.

#### DbDependencyDetector

Reutiliza los parsers del registry para detectar comandos de acceso a datos específicos de cada lenguaje. También identifica SQL dinámico que no puede analizarse estáticamente.

#### GraphBuilder

Construye el grafo de dependencias integrando módulos y referencias BD:

```mermaid
graph LR
    subgraph Nodos
        MOD[module:nombre]
        CLS[class:modulo:clase]
        TBL[table:tabla]
        EXT[external:servicio]
    end

    subgraph Aristas
        MOD -->|code_to_code| CLS
        MOD -->|code_to_table| TBL
        MOD -->|module_to_external| EXT
    end
```

Convenciones de IDs:
- Módulos: `module:{nombre}`
- Clases: `class:{modulo}:{clase}`
- Tablas: `table:{tabla}`
- Externos: `external:{nombre}`

#### MetricsCalculator

Calcula métricas de acoplamiento a partir del grafo:

```mermaid
graph LR
    A[Módulo A] -->|depende de| B[Módulo B]
    C[Módulo C] -->|depende de| B

    subgraph "Métricas de B"
        CA["Ca = 2 (A y C dependen de B)"]
        CE["Ce = 0 (B no depende de nadie)"]
        I["I = 0 / (2 + 0) = 0 (estable)"]
    end
```

## Arquitectura del Conector de BD

El Conector de BD gestiona conexiones a bases de datos reales y proporciona introspección de esquemas, validación de dependencias y enriquecimiento de planes.

```mermaid
graph TD
    DC[DbConnector] --> AF[Adapter Factory]
    AF --> PA[PostgresAdapter]
    AF --> MA[MysqlAdapter]
    AF --> MSA[MssqlAdapter]
    AF --> OA[OracleAdapter]
    AF --> DA[Db2Adapter]

    DC --> DI[DbIntrospector]
    DC --> TV[TableValidator]
    DC --> PE[PlanEnricher]

    DI -->|TableSchema| PE
    DI -->|table names| TV
    TV -->|ValidationReport| OUT1[Reporte de Validación]
    PE -->|EnrichedPlan| OUT2[Plan Enriquecido]
```

### Componentes del Conector BD

#### DbConnector

Gestiona el ciclo de vida de la conexión: valida configuración, resuelve el adaptador correcto según `databaseType`, y delega connect/disconnect al adaptador.

#### DbIntrospector

Obtiene información de esquema desde la BD viva: lista de tablas, esquemas de tabla (columnas, primary keys, foreign keys). Envuelve errores de conexión en `ConnectionLostError`.

#### TableValidator

Compara las tablas referenciadas en el código legacy (del `DbDependencyMap`) contra las tablas reales en la BD. Clasifica cada tabla como `found` o `not_found`, y usa distancia Levenshtein para sugerir tablas similares cuando no se encuentra una referencia.

#### PlanEnricher

Enriquece un `DecompositionPlan` con metadata real de BD:
1. Recolecta todas las tablas únicas del plan
2. Obtiene `TableSchema` para cada tabla vía `DbIntrospector`
3. Construye `ServiceSchemaMap` por servicio
4. Detecta foreign keys que cruzan fronteras de servicio (`CrossServiceForeignKey`)
5. Registra tablas no validadas

El enriquecimiento es aditivo: los campos originales del plan se preservan intactos.

## Arquitectura del Generador API

El Generador API produce especificaciones OpenAPI 3.x a partir de planes enriquecidos.

```mermaid
graph TD
    EP[EnrichedPlan] --> GEN[generateOpenApiFromEnrichedPlan]
    GEN --> ESM[EnrichedSchemaMapper]
    ESM -->|mapTableSchemaToOpenApi| SCHEMA[OpenApiSchema]
    ESM -->|mapColumnType| PROP[OpenApiSchemaProperty]
    GEN --> CRUD[buildCrudPaths]
    GEN --> INF[buildInferredCrudPaths]
    CRUD --> SPEC[OpenApiSpec por servicio]
    INF --> SPEC
```

### Componentes del Generador API

#### EnrichedSchemaMapper

Mapea tipos de columna de BD a propiedades OpenAPI con `type` y `format` correctos. Soporta tipos enteros, numéricos, booleanos, fecha/hora, binarios, UUID y strings.

#### generateOpenApiFromEnrichedPlan

Función principal que genera un `OpenApiSpec` por cada servicio del plan:
- Tablas validadas: genera schemas precisos desde `TableSchema` real, con endpoints CRUD y parámetros de path tipados según primary keys
- Tablas no validadas: genera schemas inferidos mínimos con advertencia `[WARNING: schema inferred]`

## Arquitectura de Serialización

```mermaid
graph TD
    AR[AnalysisReport] --> ARS[AnalysisReportSerializer]
    DP[DecompositionPlan] --> DPS[DecompositionPlanSerializer]
    VR[ValidationReport] --> VRS[ValidationReportSerializer]

    ARS -->|serialize/deserialize| JSON1[JSON]
    DPS -->|serialize/deserialize| JSON2[JSON]
    VRS -->|serialize/deserialize| JSON3[JSON]
```

Los tres serializadores implementan `ISerializer<T>` y validan contra un esquema antes de deserializar, lanzando `SchemaValidationError` o `JsonParseError` según corresponda.

## Arquitectura Futura

### Descomponedor (pendiente)

Las interfaces están definidas pero la implementación está pendiente:

```mermaid
graph TD
    REPORT[AnalysisReport] --> CB[ContextBoundaryIdentifier]
    CB --> RA[RiskAssessor]
    RA --> DEC[Decomposer]
    DEC --> PLAN[DecompositionPlan]
    DEC --> CD[CircularDependencyReport]
    DEC --> ST[SharedTableStrategy]
```

Interfaces definidas:
- `IDecomposer` — recibe `AnalysisReport`, produce `DecompositionPlan`
- `IContextBoundaryIdentifier` — identifica bounded contexts desde módulos, grafo y dependencias BD
- `IRiskAssessor` — evalúa nivel de riesgo por servicio propuesto

### Exportador (pendiente)

```mermaid
graph TD
    REPORT[AnalysisReport] --> EXP[Exporter]
    PLAN[DecompositionPlan] --> EXP
    SPECS[OpenApiSpecs] --> EXP

    EXP --> JSON[JSON Exporter]
    EXP --> MD[Markdown Exporter]
    EXP --> SVG[SVG Renderer]

    JSON --> OUT[Directorio de salida]
    MD --> OUT
    SVG --> OUT
```

## Jerarquía de Errores

```mermaid
classDiagram
    class ToolkitError {
        +code: string
        +message: string
        +details?: Record
    }

    ToolkitError <|-- InvalidPathError
    ToolkitError <|-- NoSourceFilesError
    ToolkitError <|-- SchemaValidationError
    ToolkitError <|-- JsonParseError
    ToolkitError <|-- InvalidReportError
    ToolkitError <|-- InvalidPlanError
    ToolkitError <|-- ExportIOError
    ToolkitError <|-- ConnectionError
    ToolkitError <|-- ConnectionLostError
    ToolkitError <|-- TableNotFoundError
    ToolkitError <|-- IntrospectionError
```
