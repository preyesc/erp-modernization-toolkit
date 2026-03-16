import {
  ISerializer,
  DecompositionPlan,
  ValidationResult,
} from '../models/types.js';
import { SchemaValidationError, JsonParseError } from '../models/errors.js';

const REQUIRED_METADATA_FIELDS = [
  'createdAt', 'sourceReportId', 'toolkitVersion', 'totalServices',
] as const;

const REQUIRED_TOP_LEVEL_FIELDS = [
  'metadata', 'services', 'sharedTables', 'circularDependencies',
] as const;

function validateDecompositionPlanShape(obj: unknown): string[] {
  const errors: string[] = [];
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
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
  if (typeof record.metadata !== 'object' || record.metadata === null) {
    errors.push("'metadata' debe ser un objeto");
  } else {
    const meta = record.metadata as Record<string, unknown>;
    for (const f of REQUIRED_METADATA_FIELDS) {
      if (!(f in meta)) {
        errors.push(`Campo requerido faltante en metadata: '${f}'`);
      }
    }
  }

  // arrays
  if (!Array.isArray(record.services)) errors.push("'services' debe ser un arreglo");
  if (!Array.isArray(record.sharedTables)) errors.push("'sharedTables' debe ser un arreglo");
  if (!Array.isArray(record.circularDependencies)) errors.push("'circularDependencies' debe ser un arreglo");

  return errors;
}

export class DecompositionPlanSerializer implements ISerializer<DecompositionPlan> {
  serialize(obj: DecompositionPlan): string {
    return JSON.stringify(obj);
  }

  serializePretty(obj: DecompositionPlan): string {
    return JSON.stringify(obj, null, 2);
  }

  deserialize(json: string): DecompositionPlan {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new JsonParseError(message);
    }

    const validation = this.validate(json, parsed);
    if (!validation.valid) {
      throw new SchemaValidationError('DecompositionPlan', validation.errors);
    }

    return parsed as DecompositionPlan;
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

    const errors = validateDecompositionPlanShape(obj);
    return { valid: errors.length === 0, errors };
  }
}
