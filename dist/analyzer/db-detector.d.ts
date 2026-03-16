import { IDbDependencyDetector, IParserRegistry, ModuleInfo, DbDependencyMap, UnparsedQuery } from '../models/types.js';
export declare class DbDependencyDetector implements IDbDependencyDetector {
    private registry;
    unparsedQueries: UnparsedQuery[];
    constructor(registry: IParserRegistry);
    detect(modules: ModuleInfo[]): Promise<DbDependencyMap>;
    private detectUnparsedQueries;
}
//# sourceMappingURL=db-detector.d.ts.map