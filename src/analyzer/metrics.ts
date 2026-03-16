import { IMetricsCalculator, ModuleInfo, DependencyGraph, ModuleMetrics } from '../models/types.js';

export class MetricsCalculator implements IMetricsCalculator {
  calculate(modules: ModuleInfo[], dependencies: DependencyGraph): ModuleMetrics[] {
    const moduleNames = new Set(modules.map(m => m.name));

    // Build adjacency info from edges between module-type nodes
    const afferentMap = new Map<string, Set<string>>();
    const efferentMap = new Map<string, Set<string>>();

    for (const name of moduleNames) {
      afferentMap.set(name, new Set());
      efferentMap.set(name, new Set());
    }

    // Map node IDs to module names
    const nodeToModule = new Map<string, string>();
    for (const node of dependencies.nodes) {
      if (node.type === 'module' || node.type === 'class') {
        // Find the module this node belongs to
        const moduleName = node.moduleGroup || node.name;
        if (moduleNames.has(moduleName)) {
          nodeToModule.set(node.id, moduleName);
        }
      }
    }

    for (const edge of dependencies.edges) {
      const sourceModule = nodeToModule.get(edge.source);
      const targetModule = nodeToModule.get(edge.target);

      if (sourceModule && targetModule && sourceModule !== targetModule) {
        // sourceModule depends on targetModule (efferent for source, afferent for target)
        efferentMap.get(sourceModule)!.add(targetModule);
        afferentMap.get(targetModule)!.add(sourceModule);
      }
    }

    return modules.map(mod => {
      const ca = afferentMap.get(mod.name)?.size ?? 0;
      const ce = efferentMap.get(mod.name)?.size ?? 0;
      const instability = ca + ce === 0 ? 0 : ce / (ca + ce);

      return {
        moduleName: mod.name,
        afferentCoupling: ca,
        efferentCoupling: ce,
        instability,
      };
    });
  }
}
