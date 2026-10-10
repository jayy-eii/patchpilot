import { ServiceNode, DependencyEdge } from '../types';

export interface RawImportService {
  id: string;
  name: string;
  criticality?: string | number; // 'tier-1' | 'tier-2' | 'tier-3' or 1 | 2 | 3
  category?: string;
  description?: string;
}

export interface RawImportDependency {
  from: string;
  to: string;
  type?: string;
  critical?: boolean;
  description?: string;
}

export interface RawImportPayload {
  services: RawImportService[];
  dependencies: RawImportDependency[];
}

export interface TopologyValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedServices?: ServiceNode[];
  sanitizedDependencies?: DependencyEdge[];
}

export class TopologyValidator {
  /**
   * Validates and normalizes custom user-supplied architecture JSON:
   * Checks for duplicate IDs, missing node references, self-loops, and invalid fields.
   */
  public static validate(payload: any): TopologyValidationResult {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      return { isValid: false, errors: ['Payload must be a valid JSON object.'] };
    }

    if (!Array.isArray(payload.services)) {
      errors.push("Missing or invalid 'services' array. Expected an array of service objects.");
    }

    if (!Array.isArray(payload.dependencies)) {
      errors.push("Missing or invalid 'dependencies' array. Expected an array of dependency objects.");
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    if (payload.services.length === 0) {
      errors.push("'services' array cannot be empty. At least 1 service is required.");
    }

    const serviceIdSet = new Set<string>();
    const sanitizedServices: ServiceNode[] = [];

    // Validate each service
    payload.services.forEach((s: any, index: number) => {
      const idxLabel = `Service #${index + 1}`;

      if (!s || typeof s !== 'object') {
        errors.push(`${idxLabel} is not a valid object.`);
        return;
      }

      if (!s.id || typeof s.id !== 'string' || s.id.trim() === '') {
        errors.push(`${idxLabel} must have a non-empty string 'id'.`);
        return;
      }

      const id = s.id.trim();

      if (serviceIdSet.has(id)) {
        errors.push(`Duplicate service id detected: '${id}'. Every service must have a unique ID.`);
        return;
      }
      serviceIdSet.add(id);

      if (!s.name || typeof s.name !== 'string' || s.name.trim() === '') {
        errors.push(`${idxLabel} (id: '${id}') must have a non-empty string 'name'.`);
      }

      // Normalize criticality tier (1, 2, or 3)
      let tier: 1 | 2 | 3 = 2;
      if (s.criticality === 1 || s.criticality === '1' || s.criticality === 'tier-1' || s.criticality === 'high' || s.tier === 1) {
        tier = 1;
      } else if (s.criticality === 3 || s.criticality === '3' || s.criticality === 'tier-3' || s.criticality === 'low' || s.tier === 3) {
        tier = 3;
      }

      // Calculate automatic grid layout position for React Flow
      const col = index % 3;
      const row = Math.floor(index / 3);
      const posX = 100 + col * 320;
      const posY = 80 + row * 160;

      sanitizedServices.push({
        id,
        name: s.name ? s.name.trim() : id,
        category: (s.category || 'core') as any,
        tier,
        status: 'healthy',
        description: s.description ? s.description.trim() : `Imported ${s.name || id} service node.`,
        healthMetric: typeof s.healthMetric === 'number' ? s.healthMetric : 99.9,
        position: s.position && typeof s.position.x === 'number' ? s.position : { x: posX, y: posY },
        icon: s.icon || (tier === 1 ? 'shield' : 'box'),
        metadata: {
          team: s.team || 'Engineering',
          runtime: s.runtime || 'Microservice',
          protocol: s.protocol || 'HTTP/JSON',
          maxLatencyMs: s.maxLatencyMs || 100,
        },
      });
    });

    const sanitizedDependencies: DependencyEdge[] = [];
    const seenEdges = new Set<string>();

    // Validate each dependency edge
    payload.dependencies.forEach((d: any, index: number) => {
      const idxLabel = `Dependency #${index + 1}`;

      if (!d || typeof d !== 'object') {
        errors.push(`${idxLabel} is not a valid object.`);
        return;
      }

      // Support either { from, to } or { source, target }
      const from = (d.from || d.source)?.toString().trim();
      const to = (d.to || d.target)?.toString().trim();

      if (!from) {
        errors.push(`${idxLabel} is missing 'from' (source caller) reference.`);
        return;
      }

      if (!to) {
        errors.push(`${idxLabel} is missing 'to' (target dependency) reference.`);
        return;
      }

      // Self-loop validation
      if (from === to) {
        errors.push(`Self-loop detected on '${from}': A service cannot depend on itself.`);
      }

      // Missing node reference validation
      if (!serviceIdSet.has(from)) {
        errors.push(`Invalid 'from' reference in dependency #${index + 1}: Service '${from}' does not exist in services list.`);
      }

      if (!serviceIdSet.has(to)) {
        errors.push(`Invalid 'to' reference in dependency #${index + 1}: Service '${to}' does not exist in services list.`);
      }

      // Duplicate edge validation
      const edgeKey = `${from}->${to}`;
      if (seenEdges.has(edgeKey)) {
        errors.push(`Duplicate dependency edge detected between '${from}' and '${to}'.`);
      } else {
        seenEdges.add(edgeKey);
      }

      sanitizedDependencies.push({
        id: d.id || `edge-${from}-${to}`,
        source: from,
        target: to,
        type: (d.type || 'sync-rest') as any,
        critical: d.critical !== undefined ? Boolean(d.critical) : true,
        description: d.description || `${from} depends on ${to}`,
        latencyBudgetMs: d.latencyBudgetMs || 100,
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedServices: errors.length === 0 ? sanitizedServices : undefined,
      sanitizedDependencies: errors.length === 0 ? sanitizedDependencies : undefined,
    };
  }
}
