export class ToolkitError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ToolkitError';
    }
}
export class InvalidPathError extends ToolkitError {
    constructor(path) {
        super('INVALID_PATH', `La ruta proporcionada no existe o no es accesible: ${path}`, { path });
    }
}
export class NoSourceFilesError extends ToolkitError {
    constructor(path) {
        super('NO_SOURCE_FILES', `No se encontraron archivos fuente válidos en: ${path}`, { path });
    }
}
export class SchemaValidationError extends ToolkitError {
    constructor(schemaName, errors) {
        super('SCHEMA_VALIDATION', `El JSON no cumple con el esquema ${schemaName}`, { schemaName, errors });
    }
}
export class JsonParseError extends ToolkitError {
    constructor(message, position) {
        super('JSON_PARSE', `Error al parsear JSON: ${message}`, { position });
    }
}
export class InvalidReportError extends ToolkitError {
    constructor(reason) {
        super('INVALID_REPORT', `El reporte de análisis es inválido: ${reason}`, { reason });
    }
}
export class InvalidPlanError extends ToolkitError {
    constructor(reason) {
        super('INVALID_PLAN', `El plan de descomposición es inválido: ${reason}`, { reason });
    }
}
export class ExportIOError extends ToolkitError {
    constructor(path, reason) {
        super('EXPORT_IO', `Error de escritura en disco: ${reason} (ruta: ${path})`, { path, reason });
    }
}
//# sourceMappingURL=errors.js.map