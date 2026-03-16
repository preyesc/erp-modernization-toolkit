export declare class ToolkitError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare class InvalidPathError extends ToolkitError {
    constructor(path: string);
}
export declare class NoSourceFilesError extends ToolkitError {
    constructor(path: string);
}
export declare class SchemaValidationError extends ToolkitError {
    constructor(schemaName: string, errors: string[]);
}
export declare class JsonParseError extends ToolkitError {
    constructor(message: string, position?: number);
}
export declare class InvalidReportError extends ToolkitError {
    constructor(reason: string);
}
export declare class InvalidPlanError extends ToolkitError {
    constructor(reason: string);
}
export declare class ExportIOError extends ToolkitError {
    constructor(path: string, reason: string);
}
//# sourceMappingURL=errors.d.ts.map