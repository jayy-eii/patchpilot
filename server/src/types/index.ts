export type ServiceCategory = 'gateway' | 'auth' | 'core' | 'database' | 'messaging';

export type ServiceStatus = 'healthy' | 'failed' | 'affected' | 'degraded';

export type EdgeType = 'sync-rest' | 'async-event' | 'db-query' | 'grpc';

export interface ServiceNode {
  id: string;
  name: string;
  category: ServiceCategory;
  tier: 1 | 2 | 3; // 1 = Critical Core, 2 = Standard, 3 = Auxiliary
  status: ServiceStatus;
  description: string;
  healthMetric: number; // e.g. 99.98
  position: { x: number; y: number };
  icon: string;
  metadata?: {
    team?: string;
    runtime?: string;
    protocol?: string;
    maxLatencyMs?: number;
  };
}

export interface DependencyEdge {
  id: string;
  source: string; // The service that depends on target (Caller/Dependent)
  target: string; // The service being called (Dependency/Provider)
  type: EdgeType;
  critical: boolean; // If true, target failure causes complete breakdown of source
  description: string;
  latencyBudgetMs?: number;
}

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskBreakdown {
  blastRadiusScore: number;      // 0-35 points based on % of total services affected
  tierWeightScore: number;        // 0-30 points based on failed service tier & impacted tiers
  criticalEdgeScore: number;      // 0-20 points based on critical call paths broken
  dataLossRiskScore: number;      // 0-15 points based on stateful/database involvement
  compositeScore: number;         // 0-100 total risk score
}

export interface IncidentReport {
  id: string;
  timestamp: string;
  failedService: ServiceNode;
  affectedDownstreamServices: ServiceNode[];
  affectedCount: number;
  totalServices: number;
  severity: SeverityLevel;
  severityScore: number;
  severityReason: string;
  dependencyPaths: string[][]; // Ordered propagation paths from failed service to dependents
  potentialBusinessImpact: string;
  suggestedMitigationSteps: string[];
  riskBreakdown: RiskBreakdown;
  activeCycleDetected?: boolean;
}

export interface RepairRecommendation {
  id: string;
  serviceId: string;
  serviceName: string;
  title: string;
  problem: string;
  proposedMitigation: string;
  whyItHelps: string;
  priority: 'P0-CRITICAL' | 'P1-HIGH' | 'P2-MEDIUM' | 'P3-LOW';
  verificationStatus: 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED';
  implementationSnippet?: string;
  tags: string[];
}

export interface SimulationResult {
  simulationId: string;
  timestamp: string;
  failedServices: string[];
  affectedServices: string[];
  healthyServices: string[];
  blastRadiusPercentage: number;
  impactedPaths: string[][];
  incidentReport: IncidentReport;
  recommendations: RepairRecommendation[];
}

export interface DemoScenario {
  id: string;
  title: string;
  subtitle: string;
  serviceId: string;
  targetName: string;
  expectedImpact: string;
  description: string;
  expectedSeverity: SeverityLevel;
  badge: string;
}

export interface GraphDataset {
  services: ServiceNode[];
  dependencies: DependencyEdge[];
}
