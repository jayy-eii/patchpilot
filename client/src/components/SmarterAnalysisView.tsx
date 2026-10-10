import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  Layers,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  GitBranch,
  Target,
  Sparkles,
} from 'lucide-react';
import {
  ServiceNode,
  ServiceBlastRadiusRank,
  DependencyChainAnalysis,
  SimulationResult,
} from '../types';
import { api } from '../api/client';
import { Tooltip } from './Tooltip';

interface SmarterAnalysisViewProps {
  services: ServiceNode[];
  onSimulateSingle: (serviceId: string) => Promise<void>;
  onSimulateMulti: (serviceIds: string[]) => Promise<void>;
  onResetSimulation: () => Promise<void>;
  activeSimulation: SimulationResult | null;
  loading: boolean;
}

export const SmarterAnalysisView: React.FC<SmarterAnalysisViewProps> = ({
  services,
  onSimulateSingle,
  onSimulateMulti,
  onResetSimulation,
  activeSimulation,
  loading,
}) => {
  const [rankings, setRankings] = useState<ServiceBlastRadiusRank[]>([]);
  const [chainAnalysis, setChainAnalysis] = useState<DependencyChainAnalysis | null>(null);
  const [selectedMultiIds, setSelectedMultiIds] = useState<string[]>([]);
  const [fetchingData, setFetchingData] = useState<boolean>(true);

  const loadAnalysisData = async () => {
    try {
      setFetchingData(true);
      const [rankingData, chainsData] = await Promise.all([
        api.getSpofRanking(),
        api.getDependencyChains(),
      ]);
      setRankings(rankingData);
      setChainAnalysis(chainsData);
    } catch (err) {
      console.error('Failed to load smarter analysis:', err);
    } finally {
      setFetchingData(false);
    }
  };

  useEffect(() => {
    loadAnalysisData();
  }, [services]);

  const toggleMultiSelect = (id: string) => {
    setSelectedMultiIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRunMultiSimulation = async () => {
    if (selectedMultiIds.length < 2) return;
    await onSimulateMulti(selectedMultiIds);
  };

  const spofs = rankings.filter(r => r.isSinglePointOfFailure);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Architectural Risk & Blast-Radius Ranking
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Dynamically evaluates every service in your topology to rank blast radiuses, detect Single Points of Failure (SPOFs), compute the longest dependency call chain, and simulate concurrent multi-service outages.
            </p>
          </div>

          <button
            disabled={fetchingData}
            onClick={loadAnalysisData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-surface-border transition-colors shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${fetchingData ? 'animate-spin' : ''}`} />
            Refresh Calculations
          </button>
        </div>
      </div>

      {/* 1. Single Point of Failure (SPOF) Highlights */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Single Point of Failure (SPOF) Detector
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Detected: <strong className="text-rose-400">{spofs.length} Critical Nodes</strong>
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Services whose individual outage knocks offline $\ge 40\%$ of the cluster or $\ge 3$ downstream services:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spofs.map(spof => (
            <div
              key={spof.serviceId}
              className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-3 shadow-lg shadow-rose-950/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-rose-300">
                    SPOF Risk Level: {spof.severity}
                  </span>
                  <h4 className="text-sm font-bold text-white">{spof.serviceName}</h4>
                </div>
                <button
                  disabled={loading}
                  onClick={() => onSimulateSingle(spof.serviceId)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-md"
                >
                  <Play className="w-3 h-3 fill-white" /> Simulate
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-surface border border-surface-border">
                  <span className="text-slate-400 text-[10px] block">Affected Victims</span>
                  <span className="text-rose-300 font-bold font-mono text-sm">{spof.affectedCount} Services</span>
                </div>
                <div className="p-2 rounded bg-surface border border-surface-border">
                  <span className="text-slate-400 text-[10px] block">Blast Radius</span>
                  <span className="text-amber-300 font-bold font-mono text-sm">{spof.blastRadiusPercentage}%</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300">
                <span className="text-slate-400 font-medium">Downstream Victims: </span>
                <span>{spof.affectedServiceNames.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Blast-Radius Ranking Table (Computed Dynamically) */}
      <div className="rounded-2xl bg-surface-card border border-surface-border overflow-hidden shadow-xl">
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Blast-Radius Ranking Table (Computed Across Entire Graph)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Sorted Descending by Impact
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/90 text-slate-400 font-mono text-[11px] uppercase border-b border-surface-border">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Affected Victims</th>
                <th className="py-3 px-4">Blast Radius</th>
                <th className="py-3 px-4">Calculated Severity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {rankings.map(rank => (
                <tr key={rank.serviceId} className="hover:bg-surface/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                    #{rank.rank}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-white block">{rank.serviceName}</span>
                    <span className="text-[10px] font-mono text-slate-400">{rank.serviceId}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    Tier-{rank.tier}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold">
                    <span className={rank.affectedCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
                      {rank.affectedCount}
                    </span>
                    {rank.affectedCount > 0 && (
                      <span className="text-[10px] text-slate-400 block font-sans">
                        ({rank.affectedServiceNames.join(', ')})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                    {rank.blastRadiusPercentage}%
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rank.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : rank.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : rank.severity === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {rank.severity} ({rank.severityScore} pts)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      disabled={loading}
                      onClick={() => onSimulateSingle(rank.serviceId)}
                      className="px-2.5 py-1 rounded-lg bg-surface hover:bg-slate-700 text-slate-200 border border-surface-border text-xs font-semibold transition-colors"
                    >
                      Simulate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Multi-Failure Simulation Console */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Multi-Failure Concurrent Outage Simulation
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Select 2+ services to test combined catastrophic failures
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Simulate what happens if multiple microservices experience simultaneous outages (e.g. concurrent payment gateway drop + auth timeout):
        </p>

        {/* Multi-Checkbox selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {services.map(s => {
            const isChecked = selectedMultiIds.includes(s.id);
            return (
              <label
                key={s.id}
                onClick={() => toggleMultiSelect(s.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-center justify-between ${
                  isChecked
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-md'
                    : 'bg-surface border-surface-border text-slate-300 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-semibold block">{s.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tier-{s.tier}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="rounded bg-surface border-surface-border text-rose-500 focus:ring-0"
                />
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-mono text-slate-400">
            Selected: <strong className="text-white">{selectedMultiIds.length} Services</strong> (Need at least 2)
          </span>

          <div className="flex items-center gap-2">
            {selectedMultiIds.length > 0 && (
              <button
                onClick={() => setSelectedMultiIds([])}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-surface-border transition-colors"
              >
                Clear Selection
              </button>
            )}

            <button
              disabled={selectedMultiIds.length < 2 || loading}
              onClick={handleRunMultiSimulation}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-rose-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Simulate Combined Multi-Failure
            </button>
          </div>
        </div>
      </div>

      {/* 4. Longest Dependency Call Chain & Circular Dependency Guard */}
      {chainAnalysis && (
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Deepest Call Hierarchy & Circular Dependency Guard
              </h3>
            </div>
            {chainAnalysis.hasCycles ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Circular Dependency Detected!
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> No Circular Dependencies (Valid DAG)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Longest transitive dependency path evaluated ({chainAnalysis.length} hops deep):
          </p>

          <div className="p-4 rounded-xl bg-surface/70 border border-surface-border flex items-center gap-2 flex-wrap text-xs font-mono">
            {chainAnalysis.longestChainNames.map((name, idx) => (
              <React.Fragment key={idx}>
                <span className="px-2.5 py-1 rounded bg-surface-border text-cyan-300 font-semibold border border-slate-700">
                  {name}
                </span>
                {idx < chainAnalysis.longestChainNames.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </React.Fragment>
            ))}
          </div>

          {chainAnalysis.hasCycles && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200">
              <strong className="text-white block mb-1">Active Cycle Paths ({chainAnalysis.cycles.length}):</strong>
              {chainAnalysis.cycles.map((c, i) => (
                <div key={i} className="font-mono text-[11px] text-rose-300">
                  Cycle #{i + 1}: {c.join(' ➔ ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
