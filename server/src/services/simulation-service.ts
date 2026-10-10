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
  private incidents: IncidentReport[] = [];
  private currentSimulation: SimulationResult | null = null;

  constructor() {
    this.services = JSON.parse(JSON.stringify(BASELINE_SERVICES));
    this.dependencies = JSON.parse(JSON.stringify(BASELINE_DEPENDENCIES));
  }

  public getServices(): ServiceNode[] {
    return this.services;
  }

  public getDependencies(): DependencyEdge[] {
    return this.dependencies;
  }

  public getScenarios(): DemoScenario[] {
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
    this.services = JSON.parse(JSON.stringify(BASELINE_SERVICES));
    this.currentSimulation = null;
    return {
      message: 'Simulation reset successfully. All services restored to baseline healthy state.',
      services: this.services,
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

    // Traverse downstream impact
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
