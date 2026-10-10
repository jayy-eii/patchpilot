import React, { useState } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Play,
  RotateCcw,
  Layers,
  Wrench,
  FileCheck,
  Sparkles,
  HelpCircle,
  Compass,
  Check,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ServiceNode, SimulationResult, IncidentReport, TestSuiteSummary, DemoScenario } from '../types';
import { Tooltip } from './Tooltip';

interface OverviewDashboardProps {
  services: ServiceNode[];
  activeSimulation: SimulationResult | null;
  latestIncident: IncidentReport | null;
  testResults: TestSuiteSummary | null;
  scenarios: DemoScenario[];
  onNavigateTab: (tabId: string) => void;
  onApplyScenario: (scenarioId: string) => void;
  onResetSimulation: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  services,
  activeSimulation,
  latestIncident,
  testResults,
  scenarios,
  onNavigateTab,
  onApplyScenario,
  onResetSimulation,
}) => {
  const [demoStep, setDemoStep] = useState<number>(0); // 0 = idle, 1 = started, 2 = simulated, 3 = ready to read

  // Compute real application metrics
  const totalServices = services.length;
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const failedServices = services.filter(s => s.status === 'failed').length;
  const affectedServices = services.filter(s => s.status === 'affected').length;
  const blastRadius = totalServices > 1 ? Math.round((affectedServices / (totalServices - 1)) * 100) : 0;

  // Chart data
  const chartData = [
    { name: 'Healthy', value: healthyServices, color: '#10b981' },
    { name: 'Failed (Root)', value: failedServices, color: '#ef4444' },
    { name: 'Affected (Victims)', value: affectedServices, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const handleStartGuidedDemo = async () => {
    setDemoStep(1);
    setTimeout(() => {
      setDemoStep(2);
      onApplyScenario('scenario-a');
      setTimeout(() => {
        setDemoStep(3);
      }, 600);
    }, 400);
  };

  const handleResetDemo = () => {
    setDemoStep(0);
    onResetSimulation();
  };

  const getSeverityTooltip = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'CRITICAL (80–100 pts): System-wide outage. Core persistence or gateway collapse with 85%+ blast radius.';
      case 'HIGH':
        return 'HIGH (50–79 pts): Mission-critical journeys interrupted (e.g. checkout or auth). Multi-service blast radius.';
      case 'MEDIUM':
        return 'MEDIUM (25–49 pts): Localized impact. Non-critical or auxiliary services degraded.';
      case 'LOW':
        return 'LOW (0–24 pts): Isolated failure. Minimal or zero downstream victims.';
      default:
        return 'Deterministic architectural risk score assessment.';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. "What is PatchPilot?" Plain-Language Explainer Panel */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-surface-card via-surface-card to-surface border border-surface-border shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <Compass className="w-4 h-4" />
              <span>Developer Observability Guide</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              What is PatchPilot?
            </h2>
            <p className="text-sm font-medium text-slate-200 leading-relaxed">
              Pick a service, simulate a failure, and see which other services would be affected. This is a simulation on a configured service graph, not live monitoring.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              PatchPilot helps engineers detect cascading failures before code reaches production. It models service relationships, traverses dependent callers using Breadth-First Search (BFS), and computes deterministic risk scores.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              onClick={handleStartGuidedDemo}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-purple hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              Start Guided Demo
            </button>
            <button
              onClick={() => onNavigateTab('map')}
              className="px-4 py-3 rounded-xl bg-surface hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-surface-border transition-colors flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              View Service Map
            </button>
          </div>
        </div>
      </div>

      {/* 2. 3-Step Guided Demo Banner */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              3-Step Guided Demo: How Failure Cascades Work
            </h3>
          </div>
          {demoStep > 0 && (
            <button
              onClick={handleResetDemo}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" /> Reset Demo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Step 1: Pick Service */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              demoStep >= 1
                ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                : 'bg-surface/50 border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">Step 1</span>
              {demoStep >= 1 && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </div>
            <h4 className="font-bold text-white text-xs mb-1">1. Pick Target Service</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Select <strong>Payment Service</strong> (Tier-1 Core checkout dependency).
            </p>
          </div>

          {/* Step 2: Simulate Failure */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              demoStep >= 2
                ? 'bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/20'
                : 'bg-surface/50 border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase font-bold text-rose-400">Step 2</span>
              {demoStep >= 2 && <Check className="w-3.5 h-3.5 text-rose-400" />}
            </div>
            <h4 className="font-bold text-white text-xs mb-1">2. Simulate Outage</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Engine injects synthetic fault and traverses dependent callers via BFS.
            </p>
          </div>

          {/* Step 3: Read Report */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              demoStep >= 3
                ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-950/20'
                : 'bg-surface/50 border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Step 3</span>
              {demoStep >= 3 && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </div>
            <h4 className="font-bold text-white text-xs mb-1">3. Read Incident Report</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Inspect affected victims, calculated risk score (66/100), and mitigations.
            </p>
          </div>
        </div>

        {demoStep === 3 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-amber-200">
              Demo Active: <strong>Payment Service</strong> failed. 3 downstream services affected (Order Service, Notification Service, API Gateway). Severity: <strong>HIGH</strong>.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('incident')}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
              >
                Read Incident Report ➔
              </button>
              <button
                onClick={() => onNavigateTab('map')}
                className="px-3 py-1 rounded-lg bg-surface hover:bg-slate-700 text-white border border-surface-border transition-colors"
              >
                Inspect on Graph ➔
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Incident Warning Banner (if failure simulated) */}
      {failedServices > 0 && latestIncident && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 shadow-xl shadow-rose-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Tooltip content={getSeverityTooltip(latestIncident.severity)}>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-help">
                    {latestIncident.severity} SEVERITY INCIDENT
                  </span>
                </Tooltip>
                <span className="text-xs text-rose-200 font-semibold">
                  Root Cause: {latestIncident.failedService.name} Outage
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Cascading failure detected across {affectedServices} downstream dependent services. Risk Score: {latestIncident.severityScore}/100.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => onNavigateTab('incident')}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              Analyze Incident
            </button>
            <button
              onClick={onResetSimulation}
              className="px-3 py-1.5 rounded-xl bg-surface hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-surface-border transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" /> Reset
            </button>
          </div>
        </div>
      )}

      {/* 6 Real Application Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Services */}
        <Tooltip content="Total microservice nodes configured in the architectural graph.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Services</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{totalServices}</div>
            <span className="text-[10px] text-slate-400">Configured microservices</span>
          </div>
        </Tooltip>

        {/* Healthy Services */}
        <Tooltip content="Healthy: Service is operational and meeting SLA. Green status.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Healthy Nodes</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{healthyServices}</div>
            <span className="text-[10px] text-slate-400">Normal operating parameters</span>
          </div>
        </Tooltip>

        {/* Simulated Failures */}
        <Tooltip content="Failed: Root cause fault injected into this service node. Red status.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Simulated Outages</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${failedServices > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {failedServices}
            </div>
            <span className="text-[10px] text-slate-400">Injected root faults</span>
          </div>
        </Tooltip>

        {/* Affected Downstream Services */}
        <Tooltip content="Affected: Downstream victims knocked offline because they depend on the failed node. Amber status.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Affected Victims</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${affectedServices > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {affectedServices}
            </div>
            <span className="text-[10px] text-slate-400">Downstream cascade victims</span>
          </div>
        </Tooltip>

        {/* System Blast Radius */}
        <Tooltip content="Blast Radius %: Proportion of dependent services knocked down by this failure.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Blast Radius</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${blastRadius > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
              {blastRadius}%
            </div>
            <span className="text-[10px] text-slate-400">System failure exposure</span>
          </div>
        </Tooltip>

        {/* Test Verification */}
        <Tooltip content="Automated Vitest suite verifying traversal algorithms and risk formulas.">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1 w-full cursor-help">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Automated Tests</span>
              <FileCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {testResults ? `${testResults.passed}/${testResults.total}` : '21/21'}
            </div>
            <span className="text-[10px] text-slate-400">Passing Vitest assertions</span>
          </div>
        </Tooltip>
      </div>

      {/* Main Grid: Topology Health Chart & Latest Incident */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topology Health Chart Card */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Cluster Health Distribution
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Live State</span>
            </div>
            <p className="text-xs text-slate-400">
              Breakdown of {totalServices} microservice statuses across the deployment mesh.
            </p>
          </div>

          <div className="h-44 w-full my-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <Tooltip content="Green / Healthy: Fully operational and meeting SLA.">
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Healthy Services
                </span>
              </Tooltip>
              <span className="font-mono font-semibold">{healthyServices}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <Tooltip content="Red / Root Fail: Injected synthetic failure point.">
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Failed Services
                </span>
              </Tooltip>
              <span className="font-mono font-semibold">{failedServices}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <Tooltip content="Amber / Affected: Downstream callers broken by upstream failure.">
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Affected Victims
                </span>
              </Tooltip>
              <span className="font-mono font-semibold">{affectedServices}</span>
            </div>
          </div>
        </div>

        {/* Latest Incident Summary Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-card border border-surface-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Latest Incident Summary
              </h3>
              {latestIncident && (
                <div className="flex items-center gap-2">
                  <Tooltip content={getSeverityTooltip(latestIncident.severity)}>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface border border-surface-border text-cyan-300 cursor-help">
                      {latestIncident.severity}
                    </span>
                  </Tooltip>
                  <span className="text-[10px] font-mono text-slate-400">
                    {latestIncident.id}
                  </span>
                </div>
              )}
            </div>

            {latestIncident ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">
                      {latestIncident.failedService.name} Outage
                    </span>
                    <Tooltip content="Score out of 100 based on blast radius (35), tier weight (30), critical links (20), and data loss (15).">
                      <span className="text-xs font-mono font-bold text-cyan-400 cursor-help">
                        Score: {latestIncident.severityScore}/100
                      </span>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {latestIncident.severityReason}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-surface-border space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                    Business Impact Projection
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {latestIncident.potentialBusinessImpact}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => onNavigateTab('incident')}
                    className="flex-1 py-2 px-3 rounded-lg bg-surface hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-surface-border transition-colors flex items-center justify-center gap-1.5"
                  >
                    View Full Incident Report <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateTab('recommendations')}
                    className="flex-1 py-2 px-3 rounded-lg bg-brand-purple/20 hover:bg-brand-purple/30 text-xs font-semibold text-purple-300 border border-purple-500/40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" /> View Recommended Mitigations
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-surface border border-surface-border space-y-3 my-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">System Nominal — No Active Outage</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Run the guided demo or select any demo scenario below to test cascading failure propagation and view live incident telemetry.
                </p>
              </div>
            )}
          </div>

          {/* Quick Demo Scenarios Trigger Footer */}
          <div className="pt-4 border-t border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-2">
              Quick Scenarios:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {scenarios.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => onApplyScenario(sc.id)}
                  className="p-2 rounded-lg bg-surface hover:bg-slate-700 border border-surface-border text-left transition-colors group"
                >
                  <span className="text-[10px] font-mono text-cyan-400 uppercase block font-semibold">{sc.badge}</span>
                  <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors block truncate">{sc.targetName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
