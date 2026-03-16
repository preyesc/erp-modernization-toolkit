import { ISerializer, DecompositionPlan, ValidationResult } from '../models/types.js';
export declare class DecompositionPlanSerializer implements ISerializer<DecompositionPlan> {
    serialize(obj: DecompositionPlan): string;
    serializePretty(obj: DecompositionPlan): string;
    deserialize(json: string): DecompositionPlan;
    validate(json: string, preParsed?: unknown): ValidationResult;
}
//# sourceMappingURL=decomposition-plan.d.ts.map