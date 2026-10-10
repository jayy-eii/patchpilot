import { ServiceNode, DependencyEdge, SeverityLevel } from '../types';
import { RiskScorer } from './risk-scorer';

export interface TraversalResult {
  rootFailedIds: string[];
  affectedServiceIds: string[];
  impactedPaths: string[][]; // e.g. [['payment-service', 'order-service', 'api-gateway']]
  directDependents: Record<string, string[]>;
  visitedOrder: string[];
  hasCycles: boolean;
  cycles: string[][];
}

export interface GraphValidationResult {
  isValid: boolean;
  missingNodes: { edgeId: string; missingId: string; role: 'source' | 'target' }[];
  duplicateEdges: string[];
  isolatedNodeIds: string[];
  cycles: string[][];
}

export interface ServiceBlastRadiusRank {
  rank: number;
  serviceId: string;
  serviceName: string;
  tier: number;
  category: string;
  affectedCount: number;
  affectedServiceIds: string[];
  affectedServiceNames: string[];
  blastRadiusPercentage: number;
  severity: SeverityLevel;
  severityScore: number;
  isSinglePointOfFailure: boolean;
}

export interface DependencyChainAnalysis {
  longestChain: string[];
  longestChainNames: string[];
  length: number;
  totalChainsEvaluated: number;
  cycles: string[][];
  hasCycles: boolean;
}

/**
 * PatchPilot Graph Analysis Engine
 *
 * Dependency Edge Semantics:
 * An edge (source -> target) represents:
 *   "source DEPENDS ON target" (e.g. Order Service depends on Payment Service)
 *
 * Impact Propagation Semantics:
 * If 'target' fails, all callers that rely on 'target' ('source' and its upstream callers)
 * experience cascading failure. Therefore, failure propagates along the reverse of the
 * functional dependency edges (from target -> source).
 */
export class GraphEngine {
  /**
   * Validates the graph for structural anomalies (missing node refs, duplicates, isolated nodes, cycles)
   */
  public static validateGraph(services: ServiceNode[], dependencies: DependencyEdge[]): GraphValidationResult {
    const serviceIds = new Set(services.map(s => s.id));
    const missingNodes: { edgeId: string; missingId: string; role: 'source' | 'target' }[] = [];
    const seenEdges = new Set<string>();
    const duplicateEdges: string[] = [];
    const connectedNodes = new Set<string>();

    for (const edge of dependencies) {
      // Missing node detection
      if (!serviceIds.has(edge.source)) {
        missingNodes.push({ edgeId: edge.id, missingId: edge.source, role: 'source' });
      } else {
        connectedNodes.add(edge.source);
      }

      if (!serviceIds.has(edge.target)) {
        missingNodes.push({ edgeId: edge.id, missingId: edge.target, role: 'target' });
      } else {
        connectedNodes.add(edge.target);
      }

      // Duplicate edge detection
      const signature = `${edge.source}->${edge.target}`;
      if (seenEdges.has(signature)) {
        duplicateEdges.push(edge.id);
      } else {
        seenEdges.add(signature);
      }
    }

    const isolatedNodeIds = services.filter(s => !connectedNodes.has(s.id)).map(s => s.id);
    const cycles = this.detectCycles(services, dependencies);

    return {
      isValid: missingNodes.length === 0,
      missingNodes,
      duplicateEdges,
      isolatedNodeIds,
      cycles,
    };
  }

  /**
   * Detects cycles in the dependency graph using DFS 3-color algorithm.
   * White (0) = unvisited, Gray (1) = visiting (in current DFS stack), Black (2) = fully processed.
   */
  public static detectCycles(services: ServiceNode[], dependencies: DependencyEdge[]): string[][] {
    const serviceIds = new Set(services.map(s => s.id));
    const adj = new Map<string, string[]>();

    for (const s of services) {
      adj.set(s.id, []);
    }

    for (const edge of dependencies) {
      if (serviceIds.has(edge.source) && serviceIds.has(edge.target)) {
        adj.get(edge.source)?.push(edge.target);
      }
    }

    const color = new Map<string, number>(); // 0: White, 1: Gray, 2: Black
    const cycles: string[][] = [];

    for (const s of services) {
      color.set(s.id, 0);
    }

    const dfs = (nodeId: string, currentPath: string[]) => {
      color.set(nodeId, 1);
      currentPath.push(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === 1) {
          // Cycle detected! Extract the cycle path
          const cycleStartIndex = currentPath.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            const cycle = [...currentPath.slice(cycleStartIndex), neighbor];
            cycles.push(cycle);
          }
        } else if (color.get(neighbor) === 0) {
          dfs(neighbor, currentPath);
        }
      }

      currentPath.pop();
      color.set(nodeId, 2);
    };

    for (const s of services) {
      if (color.get(s.id) === 0) {
        dfs(s.id, []);
      }
    }

    return cycles;
  }

  /**
   * Traverses all downstream affected services when one or more root services fail.
   *
   * Uses Breadth-First Search (BFS) over the Dependents Adjacency List.
   * Guaranteed termination even in cyclic graphs by tracking `visited` state.
   */
  public static traverseDownstreamImpact(
    rootFailedServiceIds: string[],
    services: ServiceNode[],
    dependencies: DependencyEdge[]
  ): TraversalResult {
    const serviceMap = new Map<string, ServiceNode>(services.map(s => [s.id, s]));
    const validRootIds = rootFailedServiceIds.filter(id => serviceMap.has(id));

    // Build Dependents Adjacency Map:
    // If source depends on target (source -> target), then when target fails, source is impacted.
    const dependentsMap = new Map<string, string[]>();
    for (const s of services) {
      dependentsMap.set(s.id, []);
    }

    // Sanitize and deduplicate edges
    const seenEdges = new Set<string>();
    for (const edge of dependencies) {
      if (!serviceMap.has(edge.source) || !serviceMap.has(edge.target)) {
        continue;
      }
      const sig = `${edge.target}->${edge.source}`;
      if (seenEdges.has(sig)) continue;
      seenEdges.add(sig);

      dependentsMap.get(edge.target)?.push(edge.source);
    }

    const visited = new Set<string>(validRootIds);
    const affectedSet = new Set<string>();
    const visitedOrder: string[] = [];
    const directDependentsRecord: Record<string, string[]> = {};
    const impactedPaths: string[][] = [];

    // Queue stores tuple: [currentServiceId, pathFromRoot]
    const queue: Array<[string, string[]]> = [];

    for (const rootId of validRootIds) {
      queue.push([rootId, [rootId]]);
      directDependentsRecord[rootId] = [...(dependentsMap.get(rootId) || [])];
    }

    while (queue.length > 0) {
      const [currentId, currentPath] = queue.shift()!;

      const directDependents = dependentsMap.get(currentId) || [];
      for (const dependentId of directDependents) {
        const newPath = [...currentPath, dependentId];

        if (!validRootIds.includes(dependentId)) {
          affectedSet.add(dependentId);
        }

        if (!visited.has(dependentId)) {
          visited.add(dependentId);
          visitedOrder.push(dependentId);
          impactedPaths.push(newPath);
          queue.push([dependentId, newPath]);
        } else if (!currentPath.includes(dependentId)) {
          impactedPaths.push(newPath);
        }
      }
    }

    const cycles = this.detectCycles(services, dependencies);

    return {
      rootFailedIds: validRootIds,
      affectedServiceIds: Array.from(affectedSet),
      impactedPaths,
      directDependents: directDependentsRecord,
      visitedOrder,
      hasCycles: cycles.length > 0,
      cycles,
    };
  }

  /**
   * Computes Blast-Radius Ranking and identifies Single Points of Failure (SPOF).
   * Deterministically evaluates every service in the graph and ranks them by impact.
   */
  public static computeBlastRadiusRanking(
    services: ServiceNode[],
    dependencies: DependencyEdge[]
  ): ServiceBlastRadiusRank[] {
    const serviceNameMap = new Map(services.map(s => [s.id, s.name]));
    const totalCount = services.length;
    const maxVictims = Math.max(1, totalCount - 1);

    const rankings: ServiceBlastRadiusRank[] = services.map(service => {
      const traversal = this.traverseDownstreamImpact([service.id], services, dependencies);
      const risk = RiskScorer.calculateRisk(service, traversal, services, dependencies);
      const affectedCount = traversal.affectedServiceIds.length;
      const blastRadiusPercentage = Math.round((affectedCount / maxVictims) * 100);

      // Single Point of Failure (SPOF):
      // A service whose failure takes down >= 40% of the remaining cluster or >= 3 services
      const isSinglePointOfFailure = affectedCount >= 3 || (totalCount > 2 && affectedCount / maxVictims >= 0.4);

      return {
        rank: 0,
        serviceId: service.id,
        serviceName: service.name,
        tier: service.tier,
        category: service.category,
        affectedCount,
        affectedServiceIds: traversal.affectedServiceIds,
        affectedServiceNames: traversal.affectedServiceIds.map(id => serviceNameMap.get(id) || id),
        blastRadiusPercentage,
        severity: risk.severity,
        severityScore: risk.compositeScore,
        isSinglePointOfFailure,
      };
    });

    // Rank descending: highest affected count first, then highest severity score
    rankings.sort((a, b) => {
      if (b.affectedCount !== a.affectedCount) {
        return b.affectedCount - a.affectedCount;
      }
      return b.severityScore - a.severityScore;
    });

    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return rankings;
  }

  /**
   * Finds the longest dependency call chain in the graph and detects circular dependencies.
   * Path: A calls B calls C calls D...
   */
  public static findLongestDependencyChain(
    services: ServiceNode[],
    dependencies: DependencyEdge[]
  ): DependencyChainAnalysis {
    const serviceIds = new Set(services.map(s => s.id));
    const serviceNameMap = new Map(services.map(s => [s.id, s.name]));
    const adj = new Map<string, string[]>();

    for (const s of services) {
      adj.set(s.id, []);
    }

    for (const edge of dependencies) {
      if (serviceIds.has(edge.source) && serviceIds.has(edge.target)) {
        adj.get(edge.source)?.push(edge.target);
      }
    }

    let longestChain: string[] = [];
    let totalChains = 0;

    const dfs = (currentId: string, currentPath: string[], visitedInPath: Set<string>) => {
      totalChains++;
      visitedInPath.add(currentId);
      currentPath.push(currentId);

      if (currentPath.length > longestChain.length) {
        longestChain = [...currentPath];
      }

      const neighbors = adj.get(currentId) || [];
      for (const neighbor of neighbors) {
        // Prevent infinite loop on cycles
        if (!visitedInPath.has(neighbor)) {
          dfs(neighbor, currentPath, visitedInPath);
        }
      }

      currentPath.pop();
      visitedInPath.delete(currentId);
    };

    for (const s of services) {
      dfs(s.id, [], new Set());
    }

    const cycles = this.detectCycles(services, dependencies);

    return {
      longestChain,
      longestChainNames: longestChain.map(id => serviceNameMap.get(id) || id),
      length: longestChain.length,
      totalChainsEvaluated: totalChains,
      cycles,
      hasCycles: cycles.length > 0,
    };
  }

  /**
   * Helper to format human-readable path strings, e.g. "Payment Service → Order Service → API Gateway"
   */
  public static formatDependencyPath(path: string[], services: ServiceNode[]): string {
    const serviceMap = new Map(services.map(s => [s.id, s.name]));
    return path.map(id => serviceMap.get(id) || id).join(' ➔ ');
  }
}
