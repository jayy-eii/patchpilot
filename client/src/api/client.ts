import {
  ServiceNode,
  DependencyEdge,
  SimulationResult,
  IncidentReport,
  RepairRecommendation,
  DemoScenario,
  TestSuiteSummary,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.error(`[PatchPilot API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  public async getHealth(): Promise<{ status: string; service: string }> {
    return this.request('/health');
  }

  public async getServices(): Promise<ServiceNode[]> {
    return this.request('/services');
  }

  public async getDependencies(): Promise<DependencyEdge[]> {
    return this.request('/dependencies');
  }

  public async getScenarios(): Promise<DemoScenario[]> {
    return this.request('/scenarios');
  }

  public async getIncidents(): Promise<IncidentReport[]> {
    return this.request('/incidents');
  }

  public async runSimulation(serviceId: string): Promise<SimulationResult> {
    return this.request('/simulations', {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    });
  }

  public async resetSimulation(): Promise<{ message: string; services: ServiceNode[] }> {
    return this.request('/simulations/reset', {
      method: 'POST',
    });
  }

  public async applyScenario(scenarioId: string): Promise<SimulationResult> {
    return this.request(`/scenarios/${scenarioId}/apply`, {
      method: 'POST',
    });
  }

  public async getRecommendations(serviceId: string): Promise<RepairRecommendation[]> {
    return this.request(`/recommendations/${serviceId}`);
  }

  public async getTests(): Promise<TestSuiteSummary> {
    return this.request('/tests');
  }

  public async runTests(): Promise<TestSuiteSummary> {
    return this.request('/tests/run', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
