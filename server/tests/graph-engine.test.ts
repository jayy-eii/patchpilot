import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../src/engine/graph-engine';
import { ServiceNode, DependencyEdge } from '../src/types';
import { BASELINE_SERVICES, BASELINE_DEPENDENCIES } from '../src/data/baseline';

describe('GraphEngine - Dependency Traversal & Impact Analysis', () => {
  it('correctly traverses downstream dependent services for Payment Service outage', () => {
    // Payment Service fails. Order Service and Notification Service depend on Payment Service.
    // API Gateway depends on Order Service, so it is transitively affected.
    // Auth, Inventory, and Database DO NOT depend on Payment Service, so they must remain healthy.
    const result = GraphEngine.traverseDownstreamImpact(
      ['payment-service'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(result.rootFailedIds).toEqual(['payment-service']);
    expect(result.affectedServiceIds).toContain('order-service');
    expect(result.affectedServiceIds).toContain('notification-service');
    expect(result.affectedServiceIds).toContain('api-gateway');

    // Verify non-dependents are NOT affected
    expect(result.affectedServiceIds).not.toContain('auth-service');
    expect(result.affectedServiceIds).not.toContain('inventory-service');
    expect(result.affectedServiceIds).not.toContain('database');

    // Verify propagation paths are traced
    const paths = result.impactedPaths.map(p => p.join(' -> '));
    expect(paths.some(p => p.includes('payment-service -> order-service'))).toBe(true);
    expect(paths.some(p => p.includes('payment-service -> notification-service'))).toBe(true);
  });

  it('correctly isolates a leaf node failure with zero downstream dependents (Notification Service)', () => {
    // Notification Service is a consumer leaf. No services call or depend on it.
    // When it fails, affected services count must be 0!
    const result = GraphEngine.traverseDownstreamImpact(
      ['notification-service'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(result.rootFailedIds).toEqual(['notification-service']);
    expect(result.affectedServiceIds).toHaveLength(0);
    expect(result.impactedPaths).toHaveLength(0);
  });

  it('calculates catastrophic blast radius on core persistence failure (Database)', () => {
    // Database failure affects Auth, Order, Payment, Inventory, and their callers (API Gateway, Notification)
    const result = GraphEngine.traverseDownstreamImpact(
      ['database'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(result.rootFailedIds).toEqual(['database']);
    expect(result.affectedServiceIds).toContain('auth-service');
    expect(result.affectedServiceIds).toContain('order-service');
    expect(result.affectedServiceIds).toContain('payment-service');
    expect(result.affectedServiceIds).toContain('inventory-service');
    expect(result.affectedServiceIds).toContain('api-gateway');
    expect(result.affectedServiceIds).toContain('notification-service');

    // 6 out of 7 total services affected
    expect(result.affectedServiceIds.length).toBe(6);
  });

  it('handles isolated services with no incoming or outgoing edges cleanly', () => {
    const isolatedService: ServiceNode = {
      id: 'legacy-reporting',
      name: 'Legacy Reporting Worker',
      category: 'core',
      tier: 3,
      status: 'healthy',
      description: 'Air-gapped legacy worker',
      healthMetric: 100,
      position: { x: 0, y: 0 },
      icon: 'box',
    };

    const services = [...BASELINE_SERVICES, isolatedService];
    const validation = GraphEngine.validateGraph(services, BASELINE_DEPENDENCIES);
    expect(validation.isolatedNodeIds).toContain('legacy-reporting');

    const result = GraphEngine.traverseDownstreamImpact(
      ['legacy-reporting'],
      services,
      BASELINE_DEPENDENCIES
    );
    expect(result.affectedServiceIds).toHaveLength(0);
  });

  it('traverses multi-branch fan-out dependency trees accurately', () => {
    const customServices: ServiceNode[] = [
      { id: 'core-hub', name: 'Core Hub', category: 'core', tier: 1, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'branch-a', name: 'Branch A', category: 'core', tier: 2, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'branch-b', name: 'Branch B', category: 'core', tier: 2, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'leaf-a1', name: 'Leaf A1', category: 'core', tier: 3, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'leaf-b1', name: 'Leaf B1', category: 'core', tier: 3, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
    ];

    // branch-a depends on core-hub, branch-b depends on core-hub
    // leaf-a1 depends on branch-a, leaf-b1 depends on branch-b
    const customEdges: DependencyEdge[] = [
      { id: 'e1', source: 'branch-a', target: 'core-hub', type: 'sync-rest', critical: true, description: '' },
      { id: 'e2', source: 'branch-b', target: 'core-hub', type: 'sync-rest', critical: true, description: '' },
      { id: 'e3', source: 'leaf-a1', target: 'branch-a', type: 'sync-rest', critical: true, description: '' },
      { id: 'e4', source: 'leaf-b1', target: 'branch-b', type: 'sync-rest', critical: true, description: '' },
    ];

    const result = GraphEngine.traverseDownstreamImpact(['core-hub'], customServices, customEdges);
    expect(result.affectedServiceIds.sort()).toEqual(['branch-a', 'branch-b', 'leaf-a1', 'leaf-b1'].sort());
  });

  it('detects circular dependencies without entering infinite loops', () => {
    const cycleServices: ServiceNode[] = [
      { id: 'node-x', name: 'Node X', category: 'core', tier: 1, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'node-y', name: 'Node Y', category: 'core', tier: 1, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'node-z', name: 'Node Z', category: 'core', tier: 1, status: 'healthy', description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
    ];

    // Cycle: X depends on Y, Y depends on Z, Z depends on X
    const cyclicEdges: DependencyEdge[] = [
      { id: 'c1', source: 'node-x', target: 'node-y', type: 'sync-rest', critical: true, description: '' },
      { id: 'c2', source: 'node-y', target: 'node-z', type: 'sync-rest', critical: true, description: '' },
      { id: 'c3', source: 'node-z', target: 'node-x', type: 'sync-rest', critical: true, description: '' },
    ];

    // 1. Must detect cycles in graph validation
    const cycles = GraphEngine.detectCycles(cycleServices, cyclicEdges);
    expect(cycles.length).toBeGreaterThan(0);

    // 2. Traversal must terminate cleanly in finite time and not loop indefinitely
    const result = GraphEngine.traverseDownstreamImpact(['node-x'], cycleServices, cyclicEdges);
    expect(result.hasCycles).toBe(true);
    expect(result.affectedServiceIds).toHaveLength(2); // Y and Z
    expect(result.affectedServiceIds).toContain('node-y');
    expect(result.affectedServiceIds).toContain('node-z');
  });

  it('safely handles missing nodes or invalid edges without throwing', () => {
    const corruptedEdges: DependencyEdge[] = [
      ...BASELINE_DEPENDENCIES,
      { id: 'bad-1', source: 'non-existent-service-1', target: 'payment-service', type: 'sync-rest', critical: true, description: '' },
      { id: 'bad-2', source: 'order-service', target: 'ghost-service-2', type: 'sync-rest', critical: true, description: '' },
    ];

    const validation = GraphEngine.validateGraph(BASELINE_SERVICES, corruptedEdges);
    expect(validation.isValid).toBe(false);
    expect(validation.missingNodes.length).toBe(2);

    // Traversal should not throw and should safely ignore corrupted edges
    expect(() => {
      const result = GraphEngine.traverseDownstreamImpact(['payment-service'], BASELINE_SERVICES, corruptedEdges);
      expect(result.affectedServiceIds).toContain('order-service');
      expect(result.affectedServiceIds).not.toContain('non-existent-service-1');
    }).not.toThrow();
  });
});
