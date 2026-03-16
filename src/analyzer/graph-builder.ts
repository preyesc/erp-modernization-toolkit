import {
  ModuleInfo,
  DbDependencyMap,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
} from '../models/types.js';

export class GraphBuilder {
  build(modules: ModuleInfo[], dbDeps: DbDependencyMap): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeIds = new Set<string>();

    // Create module nodes
    for (const mod of modules) {
      const moduleId = `module:${mod.name}`;
      if (!nodeIds.has(moduleId)) {
        nodes.push({ id: moduleId, name: mod.name, type: 'module', moduleGroup: mod.name });
        nodeIds.add(moduleId);
      }

      // Create class nodes and edges
      for (const cls of mod.classes) {
        const classId = `class:${mod.name}:${cls.name}`;
        if (!nodeIds.has(classId)) {
          nodes.push({ id: classId, name: cls.name, type: 'class', moduleGroup: mod.name });
          nodeIds.add(classId);
        }
        edges.push({ source: moduleId, target: classId, type: 'code_to_code' });

        // Class dependencies → code_to_code edges
        for (const dep of cls.dependencies) {
          const targetId = this.resolveNodeId(dep, modules, nodeIds, nodes);
          if (targetId) {
            edges.push({ source: classId, target: targetId, type: 'code_to_code', label: 'depends' });
          }
        }
      }

      // Function dependencies → code_to_code edges
      for (const fn of mod.functions) {
        for (const dep of fn.dependencies) {
          const targetId = this.resolveNodeId(dep, modules, nodeIds, nodes);
          if (targetId) {
            edges.push({ source: moduleId, target: targetId, type: 'code_to_code', label: 'calls' });
          }
        }
      }
    }

    // Create table nodes and code_to_table edges from DB references
    for (const ref of dbDeps.references) {
      const tableId = `table:${ref.tableName}`;
      if (!nodeIds.has(tableId)) {
        nodes.push({ id: tableId, name: ref.tableName, type: 'table' });
        nodeIds.add(tableId);
      }

      const sourceModuleId = `module:${ref.moduleName}`;
      if (nodeIds.has(sourceModuleId)) {
        edges.push({
          source: sourceModuleId,
          target: tableId,
          type: 'code_to_table',
          label: ref.operation,
        });
      }
    }

    return { nodes, edges };
  }

  private resolveNodeId(
    name: string,
    modules: ModuleInfo[],
    nodeIds: Set<string>,
    nodes: DependencyNode[]
  ): string | null {
    // Try to find as module
    const moduleId = `module:${name}`;
    if (nodeIds.has(moduleId)) return moduleId;

    // Try to find as class in any module
    for (const mod of modules) {
      const classId = `class:${mod.name}:${name}`;
      if (nodeIds.has(classId)) return classId;
    }

    // Create as external service if not found
    const extId = `external:${name}`;
    if (!nodeIds.has(extId)) {
      nodes.push({ id: extId, name, type: 'external_service' });
      nodeIds.add(extId);
    }
    return extId;
  }
}
