# Diagramas de Secuencia

## Flujo Principal del Análisis

Secuencia completa cuando se invoca `analyzer.analyze(projectPath)`:

```mermaid
sequenceDiagram
    participant U as Usuario
    participant A as Analyzer
    participant S as CodeScanner
    participant PR as ParserRegistry
    participant LP as LanguageParser
    participant DB as DbDependencyDetector
    participant GB as GraphBuilder
    participant MC as MetricsCalculator

    U->>A: analyze(projectPath)
    
    A->>S: scan(projectPath)
    S->>S: collectFiles(projectPath)
    
    loop Para cada archivo
        S->>PR: getParserForFile(filePath)
        alt Parser encontrado
            PR-->>S: ILanguageParser
            S->>LP: parseFile(filePath, content)
            LP-->>S: ModuleInfo
        else Sin parser
            S->>S: registrar AnalysisWarning
        end
    end
    
    S-->>A: ModuleInfo[] + warnings

    A->>DB: detect(modules)
    loop Para cada módulo
        DB->>PR: getParserForFile(mod.path)
        DB->>LP: detectDbAccess(content, filePath)
        LP-->>DB: DbReference[]
        DB->>DB: detectUnparsedQueries(content)
    end
    DB-->>A: DbDependencyMap

    A->>GB: build(modules, dbDeps)
    GB->>GB: crear nodos (module, class, table, external)
    GB->>GB: crear aristas (code_to_code, code_to_table, module_to_external)
    GB-->>A: DependencyGraph

    A->>MC: calculate(modules, graph)
    MC->>MC: mapear nodos a módulos
    MC->>MC: calcular Ca, Ce, I por módulo
    MC-->>A: ModuleMetrics[]

    A->>A: construir ReportMetadata
    A-->>U: AnalysisReport
```

## Flujo del Scanner de Código

Detalle del escaneo de archivos y delegación a parsers:

```mermaid
sequenceDiagram
    participant S as CodeScanner
    participant FS as FileSystem
    participant PR as ParserRegistry
    participant P as Parser

    S->>FS: existsSync(projectPath)
    alt No existe
        S-->>S: throw InvalidPathError
    end

    S->>FS: readdirSync(projectPath)
    FS-->>S: archivos y directorios

    loop Recursivo (excluye node_modules, .git)
        S->>FS: statSync(entry)
        alt Es directorio
            S->>S: collectFiles(subdir)
        else Es archivo
            S->>S: agregar a lista
        end
    end

    alt Sin archivos
        S-->>S: throw NoSourceFilesError
    end

    loop Para cada archivo
        S->>PR: getParserForFile(filePath)
        alt Parser disponible
            S->>FS: readFileSync(filePath)
            S->>P: parseFile(filePath, content)
            P-->>S: ModuleInfo
        else Sin parser
            S->>S: push AnalysisWarning(unsupported_language)
        end
    end

    alt Sin archivos soportados
        S-->>S: throw NoSourceFilesError
    end
```

## Flujo de Detección de Dependencias BD

```mermaid
sequenceDiagram
    participant DD as DbDependencyDetector
    participant PR as ParserRegistry
    participant P as LanguageParser
    participant FS as FileSystem

    loop Para cada módulo
        DD->>PR: getParserForFile(mod.path)
        alt Parser encontrado
            DD->>FS: readFileSync(mod.path)
            DD->>P: detectDbAccess(content, filePath)
            Note right of P: Busca patrones específicos<br/>del lenguaje (Find, SELECT,<br/>READ, CHAIN, etc.)
            P-->>DD: DbReference[]
            DD->>DD: detectUnparsedQueries(content)
            Note right of DD: Detecta SQL dinámico:<br/>EXECUTE IMMEDIATE,<br/>sp_executesql, PREPARE
        end
    end

    DD-->>DD: { references, unparsedQueries }
```

## Flujo de Construcción del Grafo

```mermaid
sequenceDiagram
    participant GB as GraphBuilder
    participant N as Nodos
    participant E as Aristas

    loop Para cada módulo
        GB->>N: crear nodo module:{nombre}
        loop Para cada clase
            GB->>N: crear nodo class:{modulo}:{clase}
            GB->>E: arista module → class (code_to_code)
            loop Para cada dependencia de clase
                GB->>GB: resolveNodeId(dep)
                GB->>E: arista class → target (code_to_code)
            end
        end
        loop Para cada función con dependencias
            GB->>GB: resolveNodeId(dep)
            GB->>E: arista module → target (code_to_code)
        end
    end

    loop Para cada DbReference
        GB->>N: crear nodo table:{tabla} (si no existe)
        GB->>E: arista module → table (code_to_table)
    end
```

## Flujo de Serialización (Round-trip)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant S as Serializer
    participant V as Validator

    U->>S: serialize(report)
    S->>S: JSON.stringify(report)
    S-->>U: json string

    U->>S: deserialize(json)
    S->>S: JSON.parse(json)
    alt JSON inválido
        S-->>U: throw JsonParseError
    end
    S->>V: validate(json, parsed)
    V->>V: verificar campos requeridos
    alt Esquema inválido
        V-->>S: { valid: false, errors }
        S-->>U: throw SchemaValidationError
    end
    S-->>U: AnalysisReport
```

## Flujo Completo del Pipeline (futuro)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant A as Analyzer
    participant D as Decomposer
    participant G as ApiGenerator
    participant E as Exporter

    U->>A: analyze(projectPath)
    A-->>U: AnalysisReport

    U->>D: decompose(report)
    D-->>U: DecompositionPlan

    U->>G: generate(plan)
    G-->>U: OpenApiSpec[]

    U->>E: export(options)
    Note right of E: Empaqueta report,<br/>plan y specs en<br/>JSON + MD + SVG
    E-->>U: ExportResult
```
