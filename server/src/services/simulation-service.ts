import {
  ServiceNode,
  DependencyEdge,
  IncidentReport,
  RepairRecommendation,
  SimulationResult,
  DemoScenario,
} from '../types';
import { BASELINE_SERVICES, BASELINE_DEPENDENCIES, DEMO_SCENARIOS } from '../data/baseline';
import { GraphEngine, TraversalResult, ServiceBlastRadiusRank, DependencyChainAnalysis } from '../engine/graph-engine';
import { RiskScorer } from '../engine/risk-scorer';
import { RecommendationEngine } from '../engine/recommendation-engine';

export class SimulationService {
  private services: ServiceNode[];
  private dependencies: DependencyEdge[];
  private baselineServicesStore: ServiceNode[];
  private baselineDependenciesStore: DependencyEdge[];
  private incidents: IncidentReport[] = [];
  private currentSimulation: SimulationResult | null = null;
  private isCustomTopology: boolean = false;

  constructor() {
    this.baselineServicesStore = JSON.parse(JSON.stringify(BASELINE_SERVICES));
    this.baselineDependenciesStore = JSON.parse(JSON.stringify(BASELINE_DEPENDENCIES));
    this.services = JSON.parse(JSON.stringify(this.baselineServicesStore));
    this.dependencies = JSON.parse(JSON.stringify(this.baselineDependenciesStore));
  }

  public getServices(): ServiceNode[] {
    return this.services;
  }

  public getDependencies(): DependencyEdge[] {
    return this.dependencies;
  }

  public getScenarios(): DemoScenario[] {
    if (this.isCustomTopology) {
      const serviceIds = new Set(this.services.map(s => s.id));
      return DEMO_SCENARIOS.filter(sc => serviceIds.has(sc.serviceId));
    }
    return DEMO_SCENARIOS;
  }

  public getIncidents(): IncidentReport[] {
    return this.incidents;
  }

  public getLatestIncident(): IncidentReport | null {
    return this.incidents.length > 0 ? this.incidents[0] : null;
  }

  public getRecommendations(serviceId: string): RepairRecommendation[] {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error(`Service with ID '${serviceId}' not found.`);
    }
    return RecommendationEngine.getRecommendationsForService(service);
  }

  public getBlastRadiusRanking(): ServiceBlastRadiusRank[] {
    return GraphEngine.computeBlastRadiusRanking(this.services, this.dependencies);
  }

  public getDependencyChainAnalysis(): DependencyChainAnalysis {
    return GraphEngine.findLongestDependencyChain(this.services, this.dependencies);
  }

  public resetSimulation(): { message: string; services: ServiceNode[] } {
    this.services = JSON.parse(JSON.stringify(this.baselineServicesStore));
    this.services.forEach(s => {
      s.status = 'healthy';
    });
    this.currentSimulation = null;
    return {
      message: 'Simulation reset successfully. All services restored to baseline healthy state.',
      services: this.services,
    };
  }

  public importTopology(newServices: ServiceNode[], newDependencies: DependencyEdge[]): {
    message: string;
    servicesCount: number;
    dependenciesCount: number;
    services: ServiceNode[];
    dependencies: DependencyEdge[];
  } {
    this.baselineServicesStore = JSON.parse(JSON.stringify(newServices));
    this.baselineDependenciesStore = JSON.parse(JSON.stringify(newDependencies));
    this.services = JSON.parse(JSON.stringify(newServices));
    this.dependencies = JSON.parse(JSON.stringify(newDependencies));
    this.incidents = [];
    this.currentSimulation = null;
    this.isCustomTopology = true;

    return {
      message: `Successfully imported custom architecture (${newServices.length} services, ${newDependencies.length} dependencies).`,
      servicesCount: newServices.length,
      dependenciesCount: newDependencies.length,
      services: this.services,
      dependencies: this.dependencies,
    };
  }

  public restoreSampleTopology(): {
    message: string;
    services: ServiceNode[];
    dependencies: DependencyEdge[];
  } {
    this.baselineServicesStore = JSON.parse(JSON.stringify(BASELINE_SERVICES));
    this.baselineDependenciesStore = JSON.parse(JSON.stringify(BASELINE_DEPENDENCIES));
    this.services = JSON.parse(JSON.stringify(BASELINE_SERVICES));
    this.dependencies = JSON.parse(JSON.stringify(BASELINE_DEPENDENCIES));
    this.incidents = [];
    this.currentSimulation = null;
    this.isCustomTopology = false;

    return {
      message: 'Restored baseline e-commerce graph (7 services, 9 dependencies).',
      services: this.services,
      dependencies: this.dependencies,
    };
  }

  public exportTopology(): {
    version: string;
    exportedAt: string;
    services: Array<{ id: string; name: string; criticality: number; category: string; description: string }>;
    dependencies: Array<{ from: string; to: string; type: string; critical: boolean; description: string }>;
  } {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      services: this.services.map(s => ({
        id: s.id,
        name: s.name,
        criticality: s.tier,
        category: s.category,
        description: s.description,
      })),
      dependencies: this.dependencies.map(d => ({
        from: d.source,
        to: d.target,
        type: d.type,
        critical: d.critical,
        description: d.description,
      })),
    };
  }

  public runSimulation(failedServiceId: string): SimulationResult {
    return this.runMultiSimulation([failedServiceId]);
  }

  public runMultiSimulation(failedServiceIds: string[]): SimulationResult {
    if (!failedServiceIds || failedServiceIds.length === 0) {
      throw new Error('At least one service ID must be specified for simulation.');
    }

    const serviceMap = new Map(this.services.map(s => [s.id, s]));
    const invalidIds = failedServiceIds.filter(id => !serviceMap.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Service ID(s) not found in topology: ${invalidIds.join(', ')}`);
    }

    // Reset statuses to baseline first
    this.services.forEach(s => {
      s.status = 'healthy';
    });

    // Traverse downstream impact using BFS across all root failed services
    const traversal: TraversalResult = GraphEngine.traverseDownstreamImpact(
      failedServiceIds,
      this.services,
      this.dependencies
    );

    const rootFailedSet = new Set(failedServiceIds);
    const affectedSet = new Set(traversal.affectedServiceIds);

    // Update node statuses
    this.services.forEach(s => {
      if (rootFailedSet.has(s.id)) {
        s.status = 'failed';
      } else if (affectedSet.has(s.id)) {
        s.status = 'affected';
      } else {
        s.status = 'healthy';
      }
    });

    const primaryTargetNode = serviceMap.get(failedServiceIds[0])!;
    const allRecommendations: RepairRecommendation[] = [];
    const allMitigationSteps: string[] = [];

    failedServiceIds.forEach(id => {
      const node = serviceMap.get(id);
      if (node) {
        allRecommendations.push(...RecommendationEngine.getRecommendationsForService(node));
        allMitigationSteps.push(...RecommendationEngine.getMitigationSummarySteps(node));
      }
    });

    const incidentReport = RiskScorer.generateIncidentReport(
      primaryTargetNode,
      traversal,
      this.services,
      this.dependencies,
      allMitigationSteps
    );

    // If multi-failure, update severity reason and title to reflect multiple points of failure
    if (failedServiceIds.length > 1) {
      incidentReport.severityReason = `Multi-Service Simultaneous Outage: [${failedServiceIds.map(id => serviceMap.get(id)?.name || id).join(', ')}] failed simultaneously, knocking offline ${traversal.affectedServiceIds.length} downstream services.`;
    }

    this.incidents.unshift(incidentReport);

    const maxVictims = Math.max(1, this.services.length - failedServiceIds.length);
    const blastRadiusPercentage = Math.min(100, Math.round((traversal.affectedServiceIds.length / maxVictims) * 100));

    const healthyServices = this.services
      .filter(s => s.status === 'healthy')
      .map(s => s.id);

    const result: SimulationResult = {
      simulationId: `SIM-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      failedServices: failedServiceIds,
      affectedServices: traversal.affectedServiceIds,
      healthyServices,
      blastRadiusPercentage,
      impactedPaths: traversal.impactedPaths,
      incidentReport,
      recommendations: allRecommendations,
    };

    this.currentSimulation = result;
    return result;
  }

  public applyScenario(scenarioId: string): SimulationResult {
    const scenario = DEMO_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found.`);
    }
    return this.runSimulation(scenario.serviceId);
  }

  public getCurrentSimulation(): SimulationResult | null {
    return this.currentSimulation;
  }
}
