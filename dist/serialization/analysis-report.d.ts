import { ISerializer, AnalysisReport, ValidationResult } from '../models/types.js';
export declare class AnalysisReportSerializer implements ISerializer<AnalysisReport> {
    serialize(obj: AnalysisReport): string;
    serializePretty(obj: AnalysisReport): string;
    deserialize(json: string): AnalysisReport;
    validate(json: string, preParsed?: unknown): ValidationResult;
}
//# sourceMappingURL=analysis-report.d.ts.map