import { SchemaValidationError, JsonParseError } from '../models/errors.js';
const REQUIRED_METADATA_FIELDS = [
    'projectPath', 'analyzedAt', 'toolkitVersion',
    'totalModules', 'totalFiles', 'supportedLanguages',
];
const REQUIRED_TOP_LEVEL_FIELDS = [
    'metadata', 'modules', 'dependencyGraph', 'metrics', 'dbDependencies', 'warnings',
];
function validateAnalysisReportShape(obj) {
    const errors = [];
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        errors.push('El valor raíz debe ser un objeto');
        return errors;
    }
    const record = obj;
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
        if (!(field in record)) {
            errors.push(`Campo requerido faltante: '${field}'`);
        }
    }
    if (errors.length > 0)
        return errors;
    // metadata
    if (typeof record.metadata !== 'object' || record.metadata === null) {
        errors.push("'metadata' debe ser un objeto");
    }
    else {
        const meta = record.metadata;
        for (const f of REQUIRED_METADATA_FIELDS) {
            if (!(f in meta)) {
                errors.push(`Campo requerido faltante en metadata: '${f}'`);
            }
        }
    }
    // arrays
    if (!Array.isArray(record.modules))
        errors.push("'modules' debe ser un arreglo");
    if (!Array.isArray(record.metrics))
        errors.push("'metrics' debe ser un arreglo");
    if (!Array.isArray(record.warnings))
        errors.push("'warnings' debe ser un arreglo");
    // dependencyGraph
    if (typeof record.dependencyGraph !== 'object' || record.dependencyGraph === null) {
        errors.push("'dependencyGraph' debe ser un objeto");
    }
    else {
        const dg = record.dependencyGraph;
        if (!Array.isArray(dg.nodes))
            errors.push("'dependencyGraph.nodes' debe ser un arreglo");
        if (!Array.isArray(dg.edges))
            errors.push("'dependencyGraph.edges' debe ser un arreglo");
    }
    // dbDependencies
    if (typeof record.dbDependencies !== 'object' || record.dbDependencies === null) {
        errors.push("'dbDependencies' debe ser un objeto");
    }
    else {
        const db = record.dbDependencies;
        if (!Array.isArray(db.references))
            errors.push("'dbDependencies.references' debe ser un arreglo");
        if (!Array.isArray(db.unparsedQueries))
            errors.push("'dbDependencies.unparsedQueries' debe ser un arreglo");
    }
    return errors;
}
export class AnalysisReportSerializer {
    serialize(obj) {
        return JSON.stringify(obj);
    }
    serializePretty(obj) {
        return JSON.stringify(obj, null, 2);
    }
    deserialize(json) {
        let parsed;
        try {
            parsed = JSON.parse(json);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new JsonParseError(message);
        }
        const validation = this.validate(json, parsed);
        if (!validation.valid) {
            throw new SchemaValidationError('AnalysisReport', validation.errors);
        }
        return parsed;
    }
    validate(json, preParsed) {
        let obj;
        if (preParsed !== undefined) {
            obj = preParsed;
        }
        else {
            try {
                obj = JSON.parse(json);
            }
            catch {
                return { valid: false, errors: ['JSON con sintaxis inválida'] };
            }
        }
        const errors = validateAnalysisReportShape(obj);
        return { valid: errors.length === 0, errors };
    }
}
//# sourceMappingURL=analysis-report.js.map