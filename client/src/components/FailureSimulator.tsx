import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Zap,
  AlertTriangle,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { ServiceNode, DemoScenario, SimulationResult } from '../types';

interface FailureSimulatorProps {
  services: ServiceNode[];
  scenarios: DemoScenario[];
  activeSimulation: SimulationResult | null;
  onSimulate: (serviceId: string) => Promise<void>;
  onReset: () => Promise<void>;
  onApplyScenario: (scenarioId: string) => Promise<void>;
  loading: boolean;
}

export const FailureSimulator: React.FC<FailureSimulatorProps> = ({
  services,
  scenarios,
  activeSimulation,
  onSimulate,
  onReset,
  onApplyScenario,
  loading,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services[0]?.id || 'payment-service'
  );

  const selectedService = services.find(s => s.id === selectedServiceId);
  const isFailedActive = activeSimulation !== null;

  return (
    <div className="space-y-6">
      {/* Intro Header & Disclaimer */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Flame className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Failure Simulation Engine</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Inject synthetic faults into microservices to calculate cascading blast radius, identify downstream victim services via BFS traversal, and assess architectural risk.
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-surface/70 border border-surface-border text-[11px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Deterministic Graph BFS Analysis (Non-destructive local sandbox)</span>
          </div>
        </div>
      </div>

      {/* Preset Demo Scenarios (Scenarios A, B, C) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Pre-Configured Demo Scenarios (One-Click)
          </h3>
          <span className="text-xs text-slate-400">Select any scenario to verify deterministic traversal</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((scenario) => {
            const isCurrentlySelected = activeSimulation?.failedServices.includes(scenario.serviceId);

            return (
              <div
                key={scenario.id}
                className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                  isCurrentlySelected
                    ? 'bg-rose-950/20 border-rose-500/60 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/40'
                    : 'bg-surface-card border-surface-border hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-surface border border-surface-border text-cyan-300">
                      {scenario.badge}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        scenario.expectedSeverity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : scenario.expectedSeverity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {scenario.expectedSeverity}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1">{scenario.title}</h4>
                  <p className="text-xs text-slate-300 mb-2 font-medium">{scenario.subtitle}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{scenario.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    Target: <strong className="text-white">{scenario.targetName}</strong>
                  </span>
                  <button
                    disabled={loading}
                    onClick={() => onApplyScenario(scenario.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isCurrentlySelected
                        ? 'bg-rose-600 text-white'
                        : 'bg-surface hover:bg-slate-700 text-slate-200 border border-surface-border'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    {isCurrentlySelected ? 'Re-Run' : 'Run Scenario'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Failure Injection Console */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          Custom Service Fault Injection
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Service Dropdown */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-slate-300">
              Select Target Microservice to Fail:
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-surface-border text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} (Tier {service.tier} • {service.category}) - Currently {service.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              disabled={loading}
              onClick={() => onSimulate(selectedServiceId)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              Simulate Failure
            </button>

            {isFailedActive && (
              <button
                disabled={loading}
                onClick={onReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-surface-border transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                Reset Baseline
              </button>
            )}
          </div>
        </div>

        {/* Live Simulation Feedback Pill */}
        {activeSimulation && (
          <div className="mt-4 p-4 rounded-xl bg-surface/70 border border-surface-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-bold text-white">Active Simulation Result:</span>
                <span className="text-xs font-mono text-rose-300 font-semibold uppercase">
                  {activeSimulation.failedServices.join(', ')} [FAILED]
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Blast Radius: <strong className="text-amber-400">{activeSimulation.blastRadiusPercentage}%</strong> ({activeSimulation.affectedServices.length} Affected)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-card border border-surface-border">
                <span className="text-[11px] font-semibold text-rose-300 block mb-1">
                  Root Cause Failure ({activeSimulation.failedServices.length})
                </span>
                <span className="text-slate-200 font-medium">
                  {activeSimulation.failedServices.join(', ')}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-surface-card border border-surface-border">
                <span className="text-[11px] font-semibold text-amber-300 block mb-1">
                  Cascading Dependent Victims ({activeSimulation.affectedServices.length})
                </span>
                <span className="text-slate-300">
                  {activeSimulation.affectedServices.length === 0
                    ? 'Zero affected downstream services (Isolated leaf node).'
                    : activeSimulation.affectedServices.join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
