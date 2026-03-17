// === Interfaces del Analizador ===

export interface IAnalyzer {
  analyze(projectPath: string): Promise<AnalysisReport>;
}

export interface ILanguageParser {
  languageName: string;
  fileExtensions: string[];
  parseFile(filePath: string, content: string): ModuleInfo;
  detectDbAccess(content: string, filePath: string): DbReference[];
}

export interface IParserRegistry {
  register(parser: ILanguageParser): void;
  getParserForFile(filePath: string): ILanguageParser | null;
  getSupportedLanguages(): string[];
  getSupportedExtensions(): string[];
}

export interface ICodeScanner {
  scan(projectPath: string): Promise<ModuleInfo[]>;
  getSupportedLanguages(): string[];
}

export interface IDbDependencyDetector {
  detect(modules: ModuleInfo[]): Promise<DbDependencyMap>;
}

export interface IMetricsCalculator {
  calculate(modules: ModuleInfo[], dependencies: DependencyGraph): ModuleMetrics[];
}

// === Interfaces del Descomponedor ===

export interface IDecomposer {
  decompose(report: AnalysisReport): DecompositionPlan;
}

export interface IContextBoundaryIdentifier {
  identify(modules: ModuleInfo[], dependencies: DependencyGraph, dbDeps: DbDependencyMap): ContextBoundary[];
}

export interface IRiskAssessor {
  assess(service: ProposedService, dependencies: DependencyGraph): RiskLevel;
}

// === Interfaces del Generador API ===

export interface IApiGenerator {
  generate(plan: DecompositionPlan): OpenApiSpec[];
}

export interface IOpenApiBuilder {
  buildSpec(service: ProposedService, tables: TableInfo[]): OpenApiSpec;
}

export interface ISchemaMapper {
  mapTableToSchema(table: TableInfo): OpenApiSchema;
}

// === Interfaces del Exportador ===

export interface IExporter {
  export(options: ExportOptions): Promise<ExportResult>;
}

export interface ISvgRenderer {
  render(graph: DependencyGraph, options?: RenderOptions): string;
}

export interface IMarkdownExporter {
  exportReport(report: AnalysisReport): string;
}

// === Interfaces de Serialización ===

export interface ISerializer<T> {
  serialize(obj: T): string;
  serializePretty(obj: T): string;
  deserialize(json: string): T;
  validate(json: string): ValidationResult;
}

// === Modelos del Analizador ===

export interface ModuleInfo {
  name: string;
  path: string;
  language: string;
  classes: ClassInfo[];
  functions: FunctionInfo[];
  lineCount: number;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  dependencies: string[];
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  dependencies: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'module' | 'class' | 'table' | 'external_service';
  moduleGroup?: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'code_to_code' | 'code_to_table' | 'module_to_external';
  label?: string;
}

export interface ModuleMetrics {
  moduleName: string;
  afferentCoupling: number;
  efferentCoupling: number;
  instability: number;
}

// === Dependencias de Base de Datos ===

export interface DbDependencyMap {
  references: DbReference[];
  unparsedQueries: UnparsedQuery[];
}

export interface DbReference {
  moduleName: string;
  tableName: string;
  operation: 'read' | 'write' | 'modify';
  sourceLocation: SourceLocation;
  queryType: 'inline_sql' | 'stored_procedure' | 'table_reference';
}

export interface UnparsedQuery {
  rawQuery: string;
  sourceLocation: SourceLocation;
  reason: string;
}

export interface SourceLocation {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
}

// === Reporte de Análisis ===

export interface AnalysisReport {
  metadata: ReportMetadata;
  modules: ModuleInfo[];
  dependencyGraph: DependencyGraph;
  metrics: ModuleMetrics[];
  dbDependencies: DbDependencyMap;
  warnings: AnalysisWarning[];
}

export interface ReportMetadata {
  projectPath: string;
  analyzedAt: string;
  toolkitVersion: string;
  totalModules: number;
  totalFiles: number;
  supportedLanguages: string[];
}

export interface AnalysisWarning {
  type: 'unsupported_language' | 'unparsed_query' | 'other';
  message: string;
  filePath?: string;
}

// === Plan de Descomposición ===

export interface DecompositionPlan {
  metadata: PlanMetadata;
  services: ProposedService[];
  sharedTables: SharedTableStrategy[];
  circularDependencies: CircularDependencyReport[];
}

export interface PlanMetadata {
  createdAt: string;
  sourceReportId: string;
  toolkitVersion: string;
  totalServices: number;
}

export interface ProposedService {
  name: string;
  description: string;
  modules: string[];
  tables: string[];
  riskLevel: RiskLevel;
  externalDependencies: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SharedTableStrategy {
  tableName: string;
  sharedBy: string[];
  strategy: 'database_view' | 'data_replication' | 'shared_service' | 'table_split';
  description: string;
}

export interface CircularDependencyReport {
  modules: string[];
  suggestedResolution: string;
}

// === Generador API ===

export interface OpenApiSpec {
  openapi: string;
  info: OpenApiInfo;
  paths: Record<string, OpenApiPathItem>;
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
}

export interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
}

export interface OpenApiOperation {
  summary: string;
  operationId: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema: { type: string; format?: string };
  description?: string;
}

export interface OpenApiRequestBody {
  required?: boolean;
  content: Record<string, { schema: OpenApiSchema | { $ref: string } }>;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: OpenApiSchema | { $ref: string } }>;
}

export interface OpenApiSchema {
  type: string;
  properties?: Record<string, OpenApiSchemaProperty>;
  required?: string[];
}

export interface OpenApiSchemaProperty {
  type: string;
  format?: string;
  description?: string;
}

// === Exportación ===

export interface ExportOptions {
  outputDir: string;
  formats: ('json' | 'markdown')[];
  includeReport?: boolean;
  includePlan?: boolean;
  includeApiSpecs?: boolean;
  includeSvg?: boolean;
}

export interface ExportResult {
  outputDir: string;
  exportedFiles: string[];
  missingArtifacts: string[];
  success: boolean;
}

// === Visualización ===

export interface RenderOptions {
  width?: number;
  height?: number;
  groupByModule?: boolean;
  colorScheme?: {
    codeToCode: string;
    codeToTable: string;
    moduleToExternal: string;
  };
}

// === Tipos adicionales referenciados por interfaces ===

export interface ContextBoundary {
  name: string;
  modules: string[];
  tables: string[];
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
}

export interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// === Database Connection ===

export type DatabaseType = 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'db2';

export interface ConnectionConfig {
  databaseType: DatabaseType;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  schemaFilter?: string;
}

// === Schema Introspection ===

export interface TableSchema {
  tableName: string;
  schemaName: string;
  columns: ColumnSchema[];
  primaryKey: PrimaryKeyInfo;
  foreignKeys: ForeignKeyInfo[];
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface PrimaryKeyInfo {
  constraintName: string;
  columns: string[];
}

export interface ForeignKeyInfo {
  constraintName: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

// === Validation Report ===

export interface ValidationReport {
  metadata: ValidationReportMetadata;
  results: TableValidationResult[];
  summary: ValidationSummary;
}

export interface ValidationReportMetadata {
  validatedAt: string;
  databaseType: DatabaseType;
  databaseName: string;
  toolkitVersion: string;
}

export interface TableValidationResult {
  tableName: string;
  status: 'found' | 'not_found';
  schemaLocation?: string;
  sourceReferences: SourceLocation[];
  suggestions?: string[];
}

export interface ValidationSummary {
  totalReferences: number;
  foundCount: number;
  notFoundCount: number;
}

// === Enriched Plan ===

export interface EnrichedPlan extends DecompositionPlan {
  enrichment: PlanEnrichmentData;
}

export interface PlanEnrichmentData {
  enrichedAt: string;
  databaseType: DatabaseType;
  serviceSchemas: ServiceSchemaMap[];
  crossServiceForeignKeys: CrossServiceForeignKey[];
  unvalidatedTables: string[];
}

export interface ServiceSchemaMap {
  serviceName: string;
  tableSchemas: TableSchema[];
}

export interface CrossServiceForeignKey {
  sourceService: string;
  sourceTable: string;
  sourceColumns: string[];
  targetService: string;
  targetTable: string;
  targetColumns: string[];
  constraintName: string;
}

// === DB Connector Interfaces ===

export interface IDbAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getTableNames(schemaFilter?: string): Promise<string[]>;
  getTableSchema(tableName: string, schemaFilter?: string): Promise<TableSchema>;
  isConnected(): boolean;
}

export interface IDbConnector {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getAdapter(): IDbAdapter;
}

export interface IDbIntrospector {
  listTables(schemaFilter?: string): Promise<string[]>;
  getTableSchema(tableName: string, schemaFilter?: string): Promise<TableSchema>;
  getMultipleTableSchemas(tableNames: string[], schemaFilter?: string): Promise<Map<string, TableSchema | null>>;
}

export interface ITableValidator {
  validate(dbDeps: DbDependencyMap, schemaFilter?: string): Promise<ValidationReport>;
}

export interface IPlanEnricher {
  enrich(plan: DecompositionPlan, schemaFilter?: string): Promise<EnrichedPlan>;
}

export interface IEnrichedSchemaMapper {
  mapTableSchemaToOpenApi(schema: TableSchema): OpenApiSchema;
  mapColumnType(dbType: string, databaseType: DatabaseType): OpenApiSchemaProperty;
}
