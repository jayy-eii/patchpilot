import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from '../src/engine/recommendation-engine';
import { BASELINE_SERVICES } from '../src/data/baseline';

describe('RecommendationEngine - Deterministic Service Mitigations', () => {
  it('returns payment-specific mitigations (idempotency, circuit breaker) for Payment Service', () => {
    const payment = BASELINE_SERVICES.find(s => s.id === 'payment-service')!;
    const recs = RecommendationEngine.getRecommendationsForService(payment);

    expect(recs.length).toBeGreaterThanOrEqual(2);
    const titles = recs.map(r => r.title.toLowerCase());
    expect(titles.some(t => t.includes('idempotency'))).toBe(true);
    expect(titles.some(t => t.includes('circuit breaker'))).toBe(true);

    // Verify presence of problem, proposed mitigation, why it helps, priority
    recs.forEach(r => {
      expect(r.problem).toBeTruthy();
      expect(r.proposedMitigation).toBeTruthy();
      expect(r.whyItHelps).toBeTruthy();
      expect(r.priority).toMatch(/^P[0-3]/);
      expect(r.verificationStatus).toBe('PROPOSED');
    });
  });

  it('returns database-specific mitigations (connection pooling, read replicas) for Database', () => {
    const db = BASELINE_SERVICES.find(s => s.id === 'database')!;
    const recs = RecommendationEngine.getRecommendationsForService(db);

    expect(recs.length).toBeGreaterThanOrEqual(2);
    const titles = recs.map(r => r.title.toLowerCase());
    expect(titles.some(t => t.includes('connection pooling'))).toBe(true);
    expect(titles.some(t => t.includes('read-replica'))).toBe(true);
  });

  it('returns queue-buffering mitigations for Notification Service', () => {
    const notification = BASELINE_SERVICES.find(s => s.id === 'notification-service')!;
    const recs = RecommendationEngine.getRecommendationsForService(notification);

    expect(recs.length).toBeGreaterThanOrEqual(1);
    const titles = recs.map(r => r.title.toLowerCase());
    expect(titles.some(t => t.includes('queue-based'))).toBe(true);
  });

  it('provides mitigation summary steps suitable for incident response checklists', () => {
    const auth = BASELINE_SERVICES.find(s => s.id === 'auth-service')!;
    const steps = RecommendationEngine.getMitigationSummarySteps(auth);

    expect(steps.length).toBeGreaterThan(0);
    expect(typeof steps[0]).toBe('string');
  });
});
