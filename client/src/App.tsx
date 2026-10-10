import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { DependencyGraph } from './components/DependencyGraph';
import { FailureSimulator } from './components/FailureSimulator';
import { IncidentAnalysis } from './components/IncidentAnalysis';
import { RepairRecommendations } from './components/RepairRecommendations';
import { TestResultsView } from './components/TestResultsView';
import { DocumentationView } from './components/DocumentationView';
import { ImportArchitectureView } from './components/ImportArchitectureView';
import { ServiceDetailModal } from './components/ServiceDetailModal';
import { api } from './api/client';
import {
  ServiceNode,
  DependencyEdge,
  SimulationResult,
  IncidentReport,
  RepairRecommendation,
  DemoScenario,
  TestSuiteSummary,
} from './types';
import { AlertCircle, RefreshCw, ServerCrash } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [dependencies, setDependencies] = useState<DependencyEdge[]>([]);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null);
  const [latestIncident, setLatestIncident] = useState<IncidentReport | null>(null);
  const [recommendations, setRecommendations] = useState<RepairRecommendation[]>([]);
  const [testResults, setTestResults] = useState<TestSuiteSummary | null>(null);

  // Selection states
  const [selectedServiceForDetail, setSelectedServiceForDetail] = useState<ServiceNode | null>(null);
  const [selectedServiceIdForRecs, setSelectedServiceIdForRecs] = useState<string>('payment-service');

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial backend state
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [servicesData, dependenciesData, scenariosData, testsData, incidentsData] = await Promise.all([
        api.getServices(),
        api.getDependencies(),
        api.getScenarios(),
        api.getTests(),
        api.getIncidents(),
      ]);

      setServices(servicesData);
      setDependencies(dependenciesData);
      setScenarios(scenariosData);
      setTestResults(testsData);

      if (incidentsData && incidentsData.length > 0) {
        setLatestIncident(incidentsData[0]);
      }

      // Load initial recommendations for first available service
      const targetServiceId = servicesData[0]?.id || 'payment-service';
      setSelectedServiceIdForRecs(targetServiceId);
      const initialRecs = await api.getRecommendations(targetServiceId).catch(() => []);
      setRecommendations(initialRecs);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(
        'Unable to connect to PatchPilot backend at http://localhost:3001. Ensure the server is running with `npm run dev`.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle failure simulation
  const handleSimulate = async (serviceId: string) => {
    try {
      setActionLoading(true);
      setError(null);

      const result = await api.runSimulation(serviceId);
      setActiveSimulation(result);
      setLatestIncident(result.incidentReport);
      setRecommendations(result.recommendations);
      setSelectedServiceIdForRecs(serviceId);

      // Refresh services to sync node statuses
      const updatedServices = await api.getServices();
      setServices(updatedServices);

      // Update selected detail modal if open
      if (selectedServiceForDetail) {
        const updated = updatedServices.find(s => s.id === selectedServiceForDetail.id);
        if (updated) setSelectedServiceForDetail(updated);
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
      setError(err.message || 'Failed to execute failure simulation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle simulation reset
  const handleResetSimulation = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const res = await api.resetSimulation();
      setServices(res.services);
      setActiveSimulation(null);

      if (selectedServiceForDetail) {
        const updated = res.services.find(s => s.id === selectedServiceForDetail.id);
        if (updated) setSelectedServiceForDetail(updated);
      }
    } catch (err: any) {
      console.error('Reset error:', err);
      setError(err.message || 'Failed to reset simulation baseline.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle scenario application
  const handleApplyScenario = async (scenarioId: string) => {
    try {
      setActionLoading(true);
      setError(null);

      const result = await api.applyScenario(scenarioId);
      setActiveSimulation(result);
      setLatestIncident(result.incidentReport);
      setRecommendations(result.recommendations);
      setSelectedServiceIdForRecs(result.failedServices[0]);

      // Refresh services
      const updatedServices = await api.getServices();
      setServices(updatedServices);
    } catch (err: any) {
      console.error('Scenario error:', err);
      setError(err.message || 'Failed to apply demo scenario.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle recommendation service selection change
  const handleSelectServiceForRecs = async (serviceId: string) => {
    try {
      setSelectedServiceIdForRecs(serviceId);
      const recs = await api.getRecommendations(serviceId);
      setRecommendations(recs);
    } catch (err: any) {
      console.error('Fetch recommendations error:', err);
    }
  };

  // Handle test runner execution
  const handleRunTests = async () => {
    try {
      setActionLoading(true);
      const results = await api.runTests();
      setTestResults(results);
    } catch (err: any) {
      console.error('Test run error:', err);
      setError(err.message || 'Failed to run automated test suite.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle custom architecture import
  const handleImportTopology = async (payload: any) => {
    setActionLoading(true);
    try {
      const res = await api.importTopology(payload);
      setServices(res.services);
      setDependencies(res.dependencies);
      setActiveSimulation(null);
      setLatestIncident(null);

      if (res.services.length > 0) {
        setSelectedServiceIdForRecs(res.services[0].id);
        const recs = await api.getRecommendations(res.services[0].id).catch(() => []);
        setRecommendations(recs);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle restore sample e-commerce graph
  const handleRestoreSampleTopology = async () => {
    setActionLoading(true);
    try {
      const res = await api.restoreSampleTopology();
      setServices(res.services);
      setDependencies(res.dependencies);
      setActiveSimulation(null);
      setLatestIncident(null);
      const scenariosData = await api.getScenarios();
      setScenarios(scenariosData);

      setSelectedServiceIdForRecs('payment-service');
      const recs = await api.getRecommendations('payment-service').catch(() => []);
      setRecommendations(recs);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle export current topology as JSON
  const handleExportTopology = async () => {
    try {
      const exportData = await api.exportTopology();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patchpilot-architecture-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      setError('Failed to export graph as JSON.');
    }
  };

  const failedCount = services.filter(s => s.status === 'failed').length;
  const affectedCount = services.filter(s => s.status === 'affected').length;

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeSimulation={activeSimulation}
        onResetSimulation={handleResetSimulation}
        failedCount={failedCount}
        affectedCount={affectedCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Backend Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-between gap-4 text-xs shadow-xl">
            <div className="flex items-center gap-3 text-rose-300">
              <ServerCrash className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadInitialData}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-200 font-semibold border border-surface-border transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Retry Connection
            </button>
          </div>
        )}

        {/* Global Loading Screen */}
        {loading ? (
          <div className="min-h-[480px] flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              Connecting to PatchPilot Topology Mesh...
            </span>
          </div>
        ) : (
          <>
            {/* View 1: Overview Dashboard */}
            {activeTab === 'overview' && (
              <OverviewDashboard
                services={services}
                activeSimulation={activeSimulation}
                latestIncident={latestIncident}
                testResults={testResults}
                scenarios={scenarios}
                onNavigateTab={setActiveTab}
                onApplyScenario={handleApplyScenario}
                onResetSimulation={handleResetSimulation}
              />
            )}

            {/* View 2: Service Dependency Map */}
            {activeTab === 'map' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Interactive Service Dependency Graph</h2>
                    <p className="text-xs text-slate-400">
                      Explore directional dependencies, inspect service SLAs, or click any node to simulate failure cascades.
                    </p>
                  </div>
                </div>

                <DependencyGraph
                  services={services}
                  dependencies={dependencies}
                  selectedService={selectedServiceForDetail}
                  onSelectService={setSelectedServiceForDetail}
                  onResetSimulation={handleResetSimulation}
                  isSimulating={failedCount > 0}
                />
              </div>
            )}

            {/* View 3: Failure Simulator */}
            {activeTab === 'simulator' && (
              <FailureSimulator
                services={services}
                scenarios={scenarios}
                activeSimulation={activeSimulation}
                onSimulate={handleSimulate}
                onReset={handleResetSimulation}
                onApplyScenario={handleApplyScenario}
                loading={actionLoading}
              />
            )}

            {/* View 4: Incident Analysis */}
            {activeTab === 'incident' && (
              <IncidentAnalysis
                incident={latestIncident}
                allServices={services}
                onNavigateToRecommendations={(svcId) => {
                  setSelectedServiceIdForRecs(svcId);
                  handleSelectServiceForRecs(svcId);
                  setActiveTab('recommendations');
                }}
              />
            )}

            {/* View 5: Repair Recommendations */}
            {activeTab === 'recommendations' && (
              <RepairRecommendations
                recommendations={recommendations}
                selectedServiceId={selectedServiceIdForRecs}
                allServices={services}
                onSelectService={handleSelectServiceForRecs}
              />
            )}

            {/* View 6: Bring-Your-Own Architecture (Import / Export) */}
            {activeTab === 'import' && (
              <ImportArchitectureView
                currentServices={services}
                currentDependencies={dependencies}
                onImport={handleImportTopology}
                onRestoreSample={handleRestoreSampleTopology}
                onExport={handleExportTopology}
                loading={actionLoading}
              />
            )}

            {/* View 7: Automated Test Results */}
            {activeTab === 'tests' && (
              <TestResultsView
                testResults={testResults}
                onRunTests={handleRunTests}
                loading={actionLoading}
              />
            )}

            {/* View 8: Project Documentation & Architecture */}
            {activeTab === 'docs' && <DocumentationView />}
          </>
        )}
      </main>

      {/* Slide-over Service Inspector Modal */}
      <ServiceDetailModal
        service={selectedServiceForDetail}
        allServices={services}
        dependencies={dependencies}
        onClose={() => setSelectedServiceForDetail(null)}
        onSimulate={handleSimulate}
        onReset={handleResetSimulation}
        onViewRecommendations={(svcId) => {
          setSelectedServiceIdForRecs(svcId);
          handleSelectServiceForRecs(svcId);
          setActiveTab('recommendations');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface/30 py-6 text-center text-xs text-slate-500">
        <p>PatchPilot — Software Failure Detective MVP • Built with React Flow, Express, TypeScript & Vitest</p>
      </footer>
    </div>
  );
};

export default App;
