import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

describe('PatchPilot API Endpoints', () => {
  it('GET /api/health returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('PatchPilot API');
  });

  it('GET /api/services returns the baseline service nodes', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(7);
  });

  it('GET /api/dependencies returns all dependency edges', async () => {
    const res = await request(app).get('/api/dependencies');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(5);
  });

  it('POST /api/simulations executes failure simulation and returns affected services', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .send({ serviceId: 'payment-service' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.failedServices).toEqual(['payment-service']);
    expect(res.body.data.affectedServices).toContain('order-service');
    expect(res.body.data.affectedServices).toContain('notification-service');
    expect(res.body.data.incidentReport).toBeDefined();
    expect(res.body.data.incidentReport.severity).toBe('HIGH');
  });

  it('POST /api/simulations/reset restores all services to healthy', async () => {
    const res = await request(app).post('/api/simulations/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app).get('/api/services');
    const allHealthy = checkRes.body.data.every((s: any) => s.status === 'healthy');
    expect(allHealthy).toBe(true);
  });

  it('POST /api/scenarios/:scenarioId/apply applies Demo Scenario C (Notification Service isolated)', async () => {
    const res = await request(app).post('/api/scenarios/scenario-c/apply');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.failedServices).toEqual(['notification-service']);
    expect(res.body.data.affectedServices).toHaveLength(0); // 0 upstream victims
    expect(res.body.data.incidentReport.severity).toBe('LOW');
  });
});
