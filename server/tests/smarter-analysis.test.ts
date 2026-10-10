import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { GraphEngine } from '../src/engine/graph-engine';
import { BASELINE_SERVICES, BASELINE_DEPENDENCIES } from '../src/data/baseline';

describe('Smarter Analysis - SPOF Detector, Blast-Radius Ranking, Multi-Failure & Chains', () => {
  beforeEach(async () => {
    await request(app).post('/api/topology/restore-sample');
    await request(app).post('/api/simulations/reset');
  });

  afterAll(async () => {
    await request(app).post('/api/topology/restore-sample');
    await request(app).post('/api/simulations/reset');
  });

  it('dynamically computes blast-radius ranking and identifies Single Points of Failure', () => {
    const ranking = GraphEngine.computeBlastRadiusRanking(BASELINE_SERVICES, BASELINE_DEPENDENCIES);

    expect(ranking).toHaveLength(7);
    expect(ranking[0].rank).toBe(1);

    // Database is root persistence for 4 services and cascades to 6 victims
    expect(ranking[0].serviceId).toBe('database');
    expect(ranking[0].affectedCount).toBe(6);
    expect(ranking[0].severity).toBe('CRITICAL');
    expect(ranking[0].isSinglePointOfFailure).toBe(true);

    // Notification Service is a leaf consumer and has 0 victims
    const notificationRank = ranking.find(r => r.serviceId === 'notification-service')!;
    expect(notificationRank.affectedCount).toBe(0);
    expect(notificationRank.severity).toBe('LOW');
    expect(notificationRank.isSinglePointOfFailure).toBe(false);

    // Verify ordering is strictly descending by affectedCount
    for (let i = 0; i < ranking.length - 1; i++) {
      expect(ranking[i].affectedCount).toBeGreaterThanOrEqual(ranking[i + 1].affectedCount);
    }
  });

  it('calculates the longest dependency chain and detects presence/absence of cycles', () => {
    const analysis = GraphEngine.findLongestDependencyChain(BASELINE_SERVICES, BASELINE_DEPENDENCIES);

    // Baseline e-commerce topology: e.g. api-gateway -> order-service -> payment-service -> database (length 4)
    expect(analysis.length).toBeGreaterThanOrEqual(3);
    expect(analysis.longestChain).toContain('database');
    expect(analysis.longestChainNames.length).toBe(analysis.length);
    expect(analysis.hasCycles).toBe(false);
    expect(analysis.cycles).toHaveLength(0);
  });

  it('detects and marks circular dependencies when a cyclic loop is introduced', () => {
    const customServices = [
      { id: 'srv-1', name: 'Service 1', category: 'core' as any, tier: 1 as any, status: 'healthy' as any, description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'srv-2', name: 'Service 2', category: 'core' as any, tier: 1 as any, status: 'healthy' as any, description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
      { id: 'srv-3', name: 'Service 3', category: 'core' as any, tier: 1 as any, status: 'healthy' as any, description: '', healthMetric: 100, position: { x: 0, y: 0 }, icon: 'box' },
    ];

    const cyclicDependencies = [
      { id: 'e1', source: 'srv-1', target: 'srv-2', type: 'sync-rest' as any, critical: true, description: '' },
      { id: 'e2', source: 'srv-2', target: 'srv-3', type: 'sync-rest' as any, critical: true, description: '' },
      { id: 'e3', source: 'srv-3', target: 'srv-1', type: 'sync-rest' as any, critical: true, description: '' },
    ];

    const analysis = GraphEngine.findLongestDependencyChain(customServices, cyclicDependencies);
    expect(analysis.hasCycles).toBe(true);
    expect(analysis.cycles.length).toBeGreaterThan(0);
  });

  it('simulates concurrent multi-failure with 2+ services correctly combining impact', async () => {
    // Concurrently fail both payment-service and auth-service
    const res = await request(app)
      .post('/api/simulations/multi')
      .send({ serviceIds: ['payment-service', 'auth-service'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.failedServices).toEqual(['payment-service', 'auth-service']);

    // Order Service (depends on payment), Notification (depends on payment), Gateway (depends on auth & order)
    expect(res.body.data.affectedServices).toContain('order-service');
    expect(res.body.data.affectedServices).toContain('notification-service');
    expect(res.body.data.affectedServices).toContain('api-gateway');

    // Incident report should reflect multi-service outage
    expect(res.body.data.incidentReport.severityReason).toContain('Multi-Service Simultaneous Outage');
  });

  it('GET /api/analysis/spof-ranking returns live computed ranking via REST API', async () => {
    const res = await request(app).get('/api/analysis/spof-ranking');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(7);
    expect(res.body.data[0].serviceId).toBe('database');
  });

  it('GET /api/analysis/dependency-chains returns dependency chain details via REST API', async () => {
    const res = await request(app).get('/api/analysis/dependency-chains');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.longestChain).toBeDefined();
  });
});
