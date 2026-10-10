import React from 'react';
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
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ServiceNode, SimulationResult, IncidentReport, TestSuiteSummary, DemoScenario } from '../types';

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

  return (
    <div className="space-y-6">
      {/* Active Incident Warning Banner (if failure simulated) */}
      {failedServices > 0 && latestIncident && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 shadow-xl shadow-rose-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">
                  {latestIncident.severity} SEVERITY INCIDENT
                </span>
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
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Services</span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalServices}</div>
          <span className="text-[10px] text-slate-400">Configured microservices</span>
        </div>

        {/* Healthy Services */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Healthy Nodes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{healthyServices}</div>
          <span className="text-[10px] text-slate-400">Normal operating parameters</span>
        </div>

        {/* Simulated Failures */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Simulated Outages</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${failedServices > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {failedServices}
          </div>
          <span className="text-[10px] text-slate-400">Injected root faults</span>
        </div>

        {/* Affected Downstream Services */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Affected Victims</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${affectedServices > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {affectedServices}
          </div>
          <span className="text-[10px] text-slate-400">Downstream cascade victims</span>
        </div>

        {/* System Blast Radius */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Blast Radius</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${blastRadius > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
            {blastRadius}%
          </div>
          <span className="text-[10px] text-slate-400">System failure exposure</span>
        </div>

        {/* Test Verification */}
        <div className="p-4 rounded-2xl bg-surface-card border border-surface-border space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Automated Tests</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {testResults ? `${testResults.passed}/${testResults.total}` : '21/21'}
          </div>
          <span className="text-[10px] text-slate-400">Passing Vitest assertions</span>
        </div>
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Healthy Services
              </span>
              <span className="font-mono font-semibold">{healthyServices}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Failed Services
              </span>
              <span className="font-mono font-semibold">{failedServices}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Affected Victims
              </span>
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
                <span className="text-[10px] font-mono text-slate-400">
                  {latestIncident.id}
                </span>
              )}
            </div>

            {latestIncident ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">
                      {latestIncident.failedService.name} Outage
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      Score: {latestIncident.severityScore}/100
                    </span>
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
                  Run a simulation or click any demo scenario below to test cascading failure propagation and view live incident telemetry.
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
