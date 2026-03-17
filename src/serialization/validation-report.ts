import {
  ISerializer,
  ValidationReport,
  ValidationResult,
} from '../models/types.js';
import { SchemaValidationError, JsonParseError } from '../models/errors.js';

const VALID_DATABASE_TYPES = ['postgresql', 'mysql', 'mssql', 'oracle', 'db2'] as const;

const REQUIRED_TOP_LEVEL_FIELDS = ['metadata', 'results', 'summary'] as const;

const REQUIRED_METADATA_FIELDS = [
  'validatedAt', 'databaseType', 'databaseName', 'toolkitVersion',
] as const;

const REQUIRED_SUMMARY_FIELDS = [
  'totalReferences', 'foundCount', 'notFoundCount',
] as const;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateValidationReportShape(obj: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(obj)) {
    errors.push('El valor raíz debe ser un objeto');
    return errors;
  }

  const record = obj as Record<string, unknown>;

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in record)) {
      errors.push(`Campo requerido faltante: '${field}'`);
    }
  }
  if (errors.length > 0) return errors;

  // metadata
  if (!isObject(record.metadata)) {
    errors.push("'metadata' debe ser un objeto");
  } else {
    const meta = record.metadata as Record<string, unknown>;
    for (const f of REQUIRED_METADATA_FIELDS) {
      if (!(f in meta)) {
        errors.push(`Campo requerido faltante en metadata: '${f}'`);
      }
    }
    if (typeof meta.validatedAt !== 'string') {
      errors.push("'metadata.validatedAt' debe ser un string");
    }
    if (typeof meta.databaseType !== 'string' || !VALID_DATABASE_TYPES.includes(meta.databaseType as typeof VALID_DATABASE_TYPES[number])) {
      errors.push("'metadata.databaseType' debe ser uno de: postgresql, mysql, mssql, oracle, db2");
    }
    if (typeof meta.databaseName !== 'string') {
      errors.push("'metadata.databaseName' debe ser un string");
    }
    if (typeof meta.toolkitVersion !== 'string') {
      errors.push("'metadata.toolkitVersion' debe ser un string");
    }
  }

  // results
  if (!Array.isArray(record.results)) {
    errors.push("'results' debe ser un arreglo");
  } else {
    for (let i = 0; i < record.results.length; i++) {
      const item = record.results[i];
      if (!isObject(item)) {
        errors.push(`'results[${i}]' debe ser un objeto`);
        continue;
      }
      const entry = item as Record<string, unknown>;
      if (typeof entry.tableName !== 'string') {
        errors.push(`'results[${i}].tableName' debe ser un string`);
      }
      if (entry.status !== 'found' && entry.status !== 'not_found') {
        errors.push(`'results[${i}].status' debe ser 'found' o 'not_found'`);
      }
      if (!Array.isArray(entry.sourceReferences)) {
        errors.push(`'results[${i}].sourceReferences' debe ser un arreglo`);
      }
    }
  }

  // summary
  if (!isObject(record.summary)) {
    errors.push("'summary' debe ser un objeto");
  } else {
    const summary = record.summary as Record<string, unknown>;
    for (const f of REQUIRED_SUMMARY_FIELDS) {
      if (!(f in summary)) {
        errors.push(`Campo requerido faltante en summary: '${f}'`);
      }
    }
    if (typeof summary.totalReferences !== 'number') {
      errors.push("'summary.totalReferences' debe ser un número");
    }
    if (typeof summary.foundCount !== 'number') {
      errors.push("'summary.foundCount' debe ser un número");
    }
    if (typeof summary.notFoundCount !== 'number') {
      errors.push("'summary.notFoundCount' debe ser un número");
    }
  }

  return errors;
}

export class ValidationReportSerializer implements ISerializer<ValidationReport> {
  serialize(obj: ValidationReport): string {
    return JSON.stringify(obj);
  }

  serializePretty(obj: ValidationReport): string {
    return JSON.stringify(obj, null, 2);
  }

  deserialize(json: string): ValidationReport {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new JsonParseError(message);
    }

    const validation = this.validate(json, parsed);
    if (!validation.valid) {
      throw new SchemaValidationError('ValidationReport', validation.errors);
    }

    return parsed as ValidationReport;
  }

  validate(json: string, preParsed?: unknown): ValidationResult {
    let obj: unknown;
    if (preParsed !== undefined) {
      obj = preParsed;
    } else {
      try {
        obj = JSON.parse(json);
      } catch {
        return { valid: false, errors: ['JSON con sintaxis inválida'] };
      }
    }

    const errors = validateValidationReportShape(obj);
    return { valid: errors.length === 0, errors };
  }
}
