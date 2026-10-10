export type ServiceCategory = 'gateway' | 'auth' | 'core' | 'database' | 'messaging';
export type ServiceStatus = 'healthy' | 'failed' | 'affected' | 'degraded';
export type EdgeType = 'sync-rest' | 'async-event' | 'db-query' | 'grpc';
export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ServiceNode {
  id: string;
  name: string;
  category: ServiceCategory;
  tier: 1 | 2 | 3;
  status: ServiceStatus;
  description: string;
  healthMetric: number;
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
  source: string;
  target: string;
  type: EdgeType;
  critical: boolean;
  description: string;
  latencyBudgetMs?: number;
}

export interface RiskBreakdown {
  blastRadiusScore: number;
  tierWeightScore: number;
  criticalEdgeScore: number;
  dataLossRiskScore: number;
  compositeScore: number;
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
  dependencyPaths: string[][];
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
  verificationStatus: 'PROPOSED' | 'PENDING_REVIEW' | 'VERIFIED';
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

export interface TestCaseResult {
  name: string;
  suite: string;
  status: 'passed' | 'failed';
  durationMs: number;
  assertionCount?: number;
  errorMessage?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  timestamp: string;
  command: string;
  workingDirectory: string;
  testCases: TestCaseResult[];
  rawOutput?: string;
}
