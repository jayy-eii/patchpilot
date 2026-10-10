import { ServiceNode, DependencyEdge, SeverityLevel, RiskBreakdown, IncidentReport } from '../types';
import { TraversalResult, GraphEngine } from './graph-engine';

export class RiskScorer {
  /**
   * Computes a transparent, deterministic risk assessment for a simulated failure.
   *
   * Scoring Breakdown (Total: 0-100 pts):
   * 1. Blast Radius Score (0-35 pts): Ratio of affected services to total dependent pool.
   * 2. Tier Importance Score (0-30 pts): Intrinsic criticality of failed root node + impacted victims.
   * 3. Critical Edge Factor (0-20 pts): Number of synchronous critical RPC/REST links severed.
   * 4. Data Loss / Persistence Risk (0-15 pts): Evaluates database, ledger, and transactional exposure.
   */
  public static calculateRisk(
    rootFailedService: ServiceNode,
    traversal: TraversalResult,
    allServices: ServiceNode[],
    allDependencies: DependencyEdge[]
  ): {
    severity: SeverityLevel;
    compositeScore: number;
    riskBreakdown: RiskBreakdown;
    reason: string;
    businessImpact: string;
  } {
    const totalServices = allServices.length;
    const affectedCount = traversal.affectedServiceIds.length;
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    // 1. Blast Radius Score (0 - 35 pts)
    const maxPotentialVictims = Math.max(1, totalServices - 1);
    const blastRatio = affectedCount / maxPotentialVictims;
    const blastRadiusScore = Math.min(35, Math.round(blastRatio * 35));

    // 2. Tier Importance Score (0 - 30 pts)
    let tierScore = 0;
    if (rootFailedService.tier === 1) tierScore += 18;
    else if (rootFailedService.tier === 2) tierScore += 10;
    else tierScore += 4;

    for (const victimId of traversal.affectedServiceIds) {
      const victim = serviceMap.get(victimId);
      if (victim?.tier === 1) tierScore += 4;
      else if (victim?.tier === 2) tierScore += 2;
    }
    const tierWeightScore = Math.min(30, tierScore);

    // 3. Critical Edge Factor (0 - 20 pts)
    // Find all edges where target was failed or victim, and edge is marked critical
    const affectedOrRootSet = new Set([...traversal.rootFailedIds, ...traversal.affectedServiceIds]);
    let criticalEdgeCount = 0;

    for (const edge of allDependencies) {
      if (edge.critical && affectedOrRootSet.has(edge.target) && affectedOrRootSet.has(edge.source)) {
        criticalEdgeCount++;
      }
    }
    const criticalEdgeScore = Math.min(20, criticalEdgeCount * 5);

    // 4. Data Loss / Persistence Risk (0 - 15 pts)
    let dataLossRiskScore = 0;
    if (rootFailedService.category === 'database') {
      dataLossRiskScore = 15;
    } else if (rootFailedService.id === 'payment-service') {
      dataLossRiskScore = 12; // Financial transaction ledger impact
    } else if (rootFailedService.id === 'order-service') {
      dataLossRiskScore = 10; // Active cart & order state impact
    } else if (traversal.affectedServiceIds.includes('order-service')) {
      dataLossRiskScore = 8;
    } else {
      dataLossRiskScore = 2;
    }

    // Composite Score
    const compositeScore = Math.min(100, Math.max(0, blastRadiusScore + tierWeightScore + criticalEdgeScore + dataLossRiskScore));

    // Severity mapping
    let severity: SeverityLevel;
    if (compositeScore >= 80) {
      severity = 'CRITICAL';
    } else if (compositeScore >= 50) {
      severity = 'HIGH';
    } else if (compositeScore >= 25) {
      severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }

    // Formulate transparent reasons
    const reason = this.formulateSeverityReason(rootFailedService, affectedCount, totalServices, compositeScore, severity);
    const businessImpact = this.formulateBusinessImpact(rootFailedService, traversal.affectedServiceIds);

    return {
      severity,
      compositeScore,
      riskBreakdown: {
        blastRadiusScore,
        tierWeightScore,
        criticalEdgeScore,
        dataLossRiskScore,
        compositeScore,
      },
      reason,
      businessImpact,
    };
  }

  private static formulateSeverityReason(
    service: ServiceNode,
    affectedCount: number,
    totalServices: number,
    score: number,
    severity: SeverityLevel
  ): string {
    if (affectedCount === 0) {
      return `Failure in ${service.name} is isolated. No downstream services depend on it (0% blast radius). Composite risk score is ${score}/100 (${severity}).`;
    }
    const blastPercent = Math.round((affectedCount / totalServices) * 100);
    return `${severity} severity (${score}/100 points). Outage in Tier-${service.tier} ${service.name} cascades to ${affectedCount} downstream services (${blastPercent}% system blast radius), severing critical synchronous paths.`;
  }

  private static formulateBusinessImpact(service: ServiceNode, affectedIds: string[]): string {
    if (service.id === 'payment-service') {
      return 'Immediate drop in checkout conversion rate. Customers cannot finalize orders, causing revenue abandonment and payment webhook delays in notification channels.';
    }
    if (service.id === 'database') {
      return 'Catastrophic application paralysis. User authentication, catalog lookups, checkout pipelines, and inventory updates are completely unresponsive across all web/mobile channels.';
    }
    if (service.id === 'notification-service') {
      return 'Low direct business impact. Core checkout and browsing remain 100% operational. Transactional email & SMS receipts may be delayed until downstream queues drain.';
    }
    if (service.id === 'auth-service') {
      return 'Security perimeter failure. Inbound users cannot authenticate sessions or refresh tokens, preventing logins and account-based checkouts.';
    }
    if (service.id === 'inventory-service') {
      return 'Inventory lock failure. Order creations stall on stock reservations to prevent phantom-stock overselling.';
    }
    if (service.id === 'api-gateway') {
      return 'Complete edge ingress failure. Inbound traffic cannot reach internal microservices, resulting in 502/504 Bad Gateway errors for all users.';
    }
    return `Potential degradation across ${affectedIds.length} dependent services. Requires immediate failover and traffic rerouting.`;
  }

  /**
   * Generates a complete Incident Report structure
   */
  public static generateIncidentReport(
    rootFailedService: ServiceNode,
    traversal: TraversalResult,
    allServices: ServiceNode[],
    allDependencies: DependencyEdge[],
    mitigationSteps: string[]
  ): IncidentReport {
    const serviceMap = new Map(allServices.map(s => [s.id, s]));
    const affectedDownstreamServices = traversal.affectedServiceIds
      .map(id => serviceMap.get(id))
      .filter((s): s is ServiceNode => s !== undefined);

    const risk = this.calculateRisk(rootFailedService, traversal, allServices, allDependencies);

    return {
      id: `INC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      failedService: rootFailedService,
      affectedDownstreamServices,
      affectedCount: affectedDownstreamServices.length,
      totalServices: allServices.length,
      severity: risk.severity,
      severityScore: risk.compositeScore,
      severityReason: risk.reason,
      dependencyPaths: traversal.impactedPaths,
      potentialBusinessImpact: risk.businessImpact,
      suggestedMitigationSteps: mitigationSteps,
      riskBreakdown: risk.riskBreakdown,
      activeCycleDetected: traversal.hasCycles,
    };
  }
}
