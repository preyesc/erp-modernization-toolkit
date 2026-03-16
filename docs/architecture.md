# Arquitectura

## Visión General del Sistema

El ERP Modernization Toolkit es un pipeline de cuatro etapas que transforma código legacy en artefactos de modernización.

```mermaid
graph TD
    INPUT[Código Fuente Legacy] --> ANALYZER[Analizador]
    ANALYZER --> REPORT[AnalysisReport JSON]
    REPORT --> DECOMPOSER[Descomponedor]
    DECOMPOSER --> PLAN[DecompositionPlan JSON]
    PLAN --> APIGEN[Generador API]
    APIGEN --> SPECS[OpenAPI Specs]
    REPORT --> EXPORTER[Exportador]
    PLAN --> EXPORTER
    SPECS --> EXPORTER
    EXPORTER --> OUTPUT[JSON + Markdown + SVG]

    style ANALYZER fill:#10B981,color:#fff
    style REPORT fill:#3B82F6,color:#fff
    style PLAN fill:#3B82F6,color:#fff
    style SPECS fill:#3B82F6,color:#fff
```

## Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| TypeScript | Tipado estático, soporte JSON nativo, ecosistema de análisis |
| Interfaces por componente | Desacoplamiento, testabilidad, extensibilidad |
| JSON como formato de intercambio | Estándar, validable con JSON Schema |
| Plugin registry para parsers | Agregar lenguajes sin modificar código existente |
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

    S -->|ModuleInfo[]| A
    D -->|DbDependencyMap| A
    G -->|DependencyGraph| A
    M -->|ModuleMetrics[]| A
```

### Componentes

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

## Arquitectura de Serialización

```mermaid
graph TD
    AR[AnalysisReport] --> ARS[AnalysisReportSerializer]
    DP[DecompositionPlan] --> DPS[DecompositionPlanSerializer]

    ARS -->|serialize| JSON1[JSON String]
    ARS -->|serializePretty| JSON2[Pretty JSON]
    JSON1 -->|deserialize| AR2[AnalysisReport]
    JSON1 -->|validate| VR[ValidationResult]

    DPS -->|serialize| JSON3[JSON String]
    JSON3 -->|deserialize| DP2[DecompositionPlan]
```

Ambos serializadores implementan `ISerializer<T>` y validan contra un esquema antes de deserializar, lanzando `SchemaValidationError` o `JsonParseError` según corresponda.

## Arquitectura Futura

### Descomponedor (pendiente)

```mermaid
graph TD
    REPORT[AnalysisReport] --> CB[ContextBoundaryIdentifier]
    CB --> RA[RiskAssessor]
    RA --> DEC[Decomposer]
    DEC --> PLAN[DecompositionPlan]
    DEC --> CD[CircularDependencyReport]
    DEC --> ST[SharedTableStrategy]
```

### Generador API (pendiente)

```mermaid
graph TD
    PLAN[DecompositionPlan] --> SM[SchemaMapper]
    PLAN --> OB[OpenApiBuilder]
    SM --> OB
    OB --> SPECS[OpenApiSpec por servicio]
```

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
```
