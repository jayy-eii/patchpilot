import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { TopologyValidator } from '../src/engine/topology-validator';
import { GraphEngine } from '../src/engine/graph-engine';

describe('TopologyValidator - Bring-Your-Own Architecture Import', () => {
  afterAll(async () => {
    await request(app).post('/api/topology/restore-sample');
  });

  it('rejects payload with non-array services or dependencies', () => {
    const res1 = TopologyValidator.validate({ services: 'not-an-array', dependencies: [] });
    expect(res1.isValid).toBe(false);
    expect(res1.errors.some(e => e.includes('Missing or invalid'))).toBe(true);

    const res2 = TopologyValidator.validate({ services: [], dependencies: 'not-an-array' });
    expect(res2.isValid).toBe(false);
    expect(res2.errors.some(e => e.includes('dependencies'))).toBe(true);
  });

  it('rejects duplicate service IDs with specific error message', () => {
    const payload = {
      services: [
        { id: 'auth-service', name: 'Auth Service', criticality: 'tier-1' },
        { id: 'auth-service', name: 'Another Auth Service', criticality: 'tier-2' },
      ],
      dependencies: [],
    };

    const res = TopologyValidator.validate(payload);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes("Duplicate service id detected: 'auth-service'"))).toBe(true);
  });

  it('rejects self-loops (a service depending on itself)', () => {
    const payload = {
      services: [
        { id: 'payment-svc', name: 'Payment Service', criticality: 'tier-1' },
      ],
      dependencies: [
        { from: 'payment-svc', to: 'payment-svc' },
      ],
    };

    const res = TopologyValidator.validate(payload);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes("Self-loop detected on 'payment-svc'"))).toBe(true);
  });

  it('rejects missing node references in dependencies (ghost services)', () => {
    const payload = {
      services: [
        { id: 'gateway', name: 'Gateway', criticality: 'tier-1' },
      ],
      dependencies: [
        { from: 'gateway', to: 'ghost-backend-service' },
      ],
    };

    const res = TopologyValidator.validate(payload);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes("Service 'ghost-backend-service' does not exist in services list"))).toBe(true);
  });

  it('rejects empty IDs or empty names', () => {
    const payload = {
      services: [
        { id: '', name: 'Valid Name' },
        { id: 'valid-id', name: '' },
      ],
      dependencies: [],
    };

    const res = TopologyValidator.validate(payload);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('successfully validates and normalizes a valid custom architecture', () => {
    const payload = {
      services: [
        { id: 'user-app', name: 'User Web App', criticality: 'tier-1' },
        { id: 'auth-jwt', name: 'JWT Auth Provider', criticality: 'tier-1' },
        { id: 'catalog-svc', name: 'Catalog Service', criticality: 'tier-2' },
      ],
      dependencies: [
        { from: 'user-app', to: 'auth-jwt', type: 'sync-rest', critical: true },
        { from: 'user-app', to: 'catalog-svc', type: 'sync-rest', critical: false },
      ],
    };

    const res = TopologyValidator.validate(payload);
    expect(res.isValid).toBe(true);
    expect(res.sanitizedServices).toHaveLength(3);
    expect(res.sanitizedDependencies).toHaveLength(2);
    expect(res.sanitizedServices![0].tier).toBe(1);
    expect(res.sanitizedServices![2].tier).toBe(2);
  });

  it('API POST /api/topology/import returns 400 with specific errors for invalid input', async () => {
    const invalidPayload = {
      services: [{ id: 'a', name: 'Service A' }],
      dependencies: [{ from: 'a', to: 'missing-node' }],
    };

    const res = await request(app)
      .post('/api/topology/import')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors[0]).toContain("Service 'missing-node' does not exist");
  });

  it('API POST /api/topology/import and POST /api/topology/restore-sample work end-to-end', async () => {
    const validCustomTopology = {
      services: [
        { id: 'frontend-cdn', name: 'Edge Frontend', criticality: 'tier-1' },
        { id: 'billing-core', name: 'Billing Core', criticality: 'tier-1' },
      ],
      dependencies: [
        { from: 'frontend-cdn', to: 'billing-core', type: 'sync-rest', critical: true },
      ],
    };

    // 1. Import custom architecture
    const importRes = await request(app)
      .post('/api/topology/import')
      .send(validCustomTopology);

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.data.servicesCount).toBe(2);

    // 2. Verify /api/services reflects custom topology
    const servicesRes = await request(app).get('/api/services');
    expect(servicesRes.body.data.map((s: any) => s.id)).toEqual(['frontend-cdn', 'billing-core']);

    // 3. Run simulation on custom topology
    const simRes = await request(app)
      .post('/api/simulations')
      .send({ serviceId: 'billing-core' });

    expect(simRes.status).toBe(200);
    expect(simRes.body.data.failedServices).toEqual(['billing-core']);
    expect(simRes.body.data.affectedServices).toEqual(['frontend-cdn']); // frontend-cdn depends on billing-core!

    // 4. Restore sample e-commerce graph
    const restoreRes = await request(app).post('/api/topology/restore-sample');
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.services.length).toBe(7);

    // 5. Verify restored services
    const checkRes = await request(app).get('/api/services');
    expect(checkRes.body.data.length).toBe(7);
  });
});
