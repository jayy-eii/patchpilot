import { describe, it, expect } from 'vitest';
import { RiskScorer } from '../src/engine/risk-scorer';
import { GraphEngine } from '../src/engine/graph-engine';
import { BASELINE_SERVICES, BASELINE_DEPENDENCIES } from '../src/data/baseline';

describe('RiskScorer - Severity Rules & Transparent Scoring Formula', () => {
  it('assigns LOW severity to isolated leaf failure (Notification Service)', () => {
    const notificationService = BASELINE_SERVICES.find(s => s.id === 'notification-service')!;
    const traversal = GraphEngine.traverseDownstreamImpact(
      ['notification-service'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    const assessment = RiskScorer.calculateRisk(
      notificationService,
      traversal,
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(assessment.severity).toBe('LOW');
    expect(assessment.compositeScore).toBeLessThan(25);
    expect(assessment.riskBreakdown.blastRadiusScore).toBe(0);
    expect(assessment.reason).toContain('isolated');
  });

  it('assigns HIGH severity to critical payment pathway outage (Payment Service)', () => {
    const paymentService = BASELINE_SERVICES.find(s => s.id === 'payment-service')!;
    const traversal = GraphEngine.traverseDownstreamImpact(
      ['payment-service'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    const assessment = RiskScorer.calculateRisk(
      paymentService,
      traversal,
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(assessment.severity).toBe('HIGH');
    expect(assessment.compositeScore).toBeGreaterThanOrEqual(50);
    expect(assessment.compositeScore).toBeLessThan(80);
    expect(assessment.riskBreakdown.criticalEdgeScore).toBeGreaterThan(0);
    expect(assessment.riskBreakdown.dataLossRiskScore).toBeGreaterThan(0);
    expect(assessment.businessImpact).toContain('checkout conversion');
  });

  it('assigns CRITICAL severity to catastrophic storage cluster crash (Database)', () => {
    const databaseService = BASELINE_SERVICES.find(s => s.id === 'database')!;
    const traversal = GraphEngine.traverseDownstreamImpact(
      ['database'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    const assessment = RiskScorer.calculateRisk(
      databaseService,
      traversal,
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    expect(assessment.severity).toBe('CRITICAL');
    expect(assessment.compositeScore).toBeGreaterThanOrEqual(80);
    expect(assessment.riskBreakdown.blastRadiusScore).toBeGreaterThanOrEqual(30);
    expect(assessment.riskBreakdown.dataLossRiskScore).toBe(15);
    expect(assessment.businessImpact).toContain('Catastrophic');
  });

  it('generates a complete structured Incident Report with transparent breakdown', () => {
    const paymentService = BASELINE_SERVICES.find(s => s.id === 'payment-service')!;
    const traversal = GraphEngine.traverseDownstreamImpact(
      ['payment-service'],
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES
    );

    const incident = RiskScorer.generateIncidentReport(
      paymentService,
      traversal,
      BASELINE_SERVICES,
      BASELINE_DEPENDENCIES,
      ['Enable idempotency keys', 'Add fallback state']
    );

    expect(incident.id).toMatch(/^INC-/);
    expect(incident.failedService.id).toBe('payment-service');
    expect(incident.affectedCount).toBe(3);
    expect(incident.totalServices).toBe(BASELINE_SERVICES.length);
    expect(incident.suggestedMitigationSteps).toHaveLength(2);
    expect(incident.dependencyPaths.length).toBeGreaterThan(0);
    expect(incident.riskBreakdown).toHaveProperty('compositeScore');
  });
});
