import {
  ServiceNode,
  DependencyEdge,
  IncidentReport,
  RepairRecommendation,
  SimulationResult,
  DemoScenario,
} from '../types';
import { BASELINE_SERVICES, BASELINE_DEPENDENCIES, DEMO_SCENARIOS } from '../data/baseline';
import { GraphEngine, TraversalResult } from '../engine/graph-engine';
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
    // If custom topology is active, filter scenarios to those where service exists or return generic
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
    const service = this.services.find(s => s.id === failedServiceId);
    if (!service) {
      throw new Error(`Service '${failedServiceId}' not found in active topology.`);
    }

    // Reset statuses to baseline first
    this.services.forEach(s => {
      s.status = 'healthy';
    });

    // Traverse downstream impact using BFS
    const traversal: TraversalResult = GraphEngine.traverseDownstreamImpact(
      [failedServiceId],
      this.services,
      this.dependencies
    );

    // Update statuses
    const targetNode = this.services.find(s => s.id === failedServiceId);
    if (targetNode) {
      targetNode.status = 'failed';
    }

    const affectedSet = new Set(traversal.affectedServiceIds);
    this.services.forEach(s => {
      if (s.id !== failedServiceId && affectedSet.has(s.id)) {
        s.status = 'affected';
      }
    });

    // Recommendations & Mitigation Steps
    const recommendations = RecommendationEngine.getRecommendationsForService(targetNode!);
    const mitigationSteps = RecommendationEngine.getMitigationSummarySteps(targetNode!);

    // Incident Report & Risk Assessment
    const incidentReport = RiskScorer.generateIncidentReport(
      targetNode!,
      traversal,
      this.services,
      this.dependencies,
      mitigationSteps
    );

    // Prepend to incidents history
    this.incidents.unshift(incidentReport);

    const blastRadiusPercentage = Math.round(
      (traversal.affectedServiceIds.length / (this.services.length - 1 || 1)) * 100
    );

    const healthyServices = this.services
      .filter(s => s.status === 'healthy')
      .map(s => s.id);

    const result: SimulationResult = {
      simulationId: `SIM-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      failedServices: [failedServiceId],
      affectedServices: traversal.affectedServiceIds,
      healthyServices,
      blastRadiusPercentage,
      impactedPaths: traversal.impactedPaths,
      incidentReport,
      recommendations,
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
