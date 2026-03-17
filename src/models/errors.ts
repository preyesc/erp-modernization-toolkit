import { DatabaseType } from './types';

export class ToolkitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolkitError';
  }
}

export class InvalidPathError extends ToolkitError {
  constructor(path: string) {
    super('INVALID_PATH', `La ruta proporcionada no existe o no es accesible: ${path}`, { path });
  }
}

export class NoSourceFilesError extends ToolkitError {
  constructor(path: string) {
    super('NO_SOURCE_FILES', `No se encontraron archivos fuente válidos en: ${path}`, { path });
  }
}

export class SchemaValidationError extends ToolkitError {
  constructor(schemaName: string, errors: string[]) {
    super('SCHEMA_VALIDATION', `El JSON no cumple con el esquema ${schemaName}`, { schemaName, errors });
  }
}

export class JsonParseError extends ToolkitError {
  constructor(message: string, position?: number) {
    super('JSON_PARSE', `Error al parsear JSON: ${message}`, { position });
  }
}

export class InvalidReportError extends ToolkitError {
  constructor(reason: string) {
    super('INVALID_REPORT', `El reporte de análisis es inválido: ${reason}`, { reason });
  }
}

export class InvalidPlanError extends ToolkitError {
  constructor(reason: string) {
    super('INVALID_PLAN', `El plan de descomposición es inválido: ${reason}`, { reason });
  }
}

export class ExportIOError extends ToolkitError {
  constructor(path: string, reason: string) {
    super('EXPORT_IO', `Error de escritura en disco: ${reason} (ruta: ${path})`, { path, reason });
  }
}

export class ConnectionError extends ToolkitError {
  constructor(databaseType: DatabaseType, reason: string) {
    super('DB_CONNECTION', `Failed to connect to ${databaseType}: ${reason}`, { databaseType, reason });
  }
}

export class ConnectionLostError extends ToolkitError {
  constructor(operation: string) {
    super('DB_CONNECTION_LOST', `Connection lost during: ${operation}`, { operation });
  }
}

export class TableNotFoundError extends ToolkitError {
  constructor(tableName: string, suggestions?: string[]) {
    super('TABLE_NOT_FOUND', `Table not found: ${tableName}`, { tableName, suggestions });
  }
}

export class IntrospectionError extends ToolkitError {
  constructor(tableName: string, reason: string) {
    super('INTROSPECTION', `Failed to introspect table ${tableName}: ${reason}`, { tableName, reason });
  }
}
