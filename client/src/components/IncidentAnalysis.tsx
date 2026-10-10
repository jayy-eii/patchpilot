import React from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Activity,
} from 'lucide-react';
import { IncidentReport, ServiceNode } from '../types';

interface IncidentAnalysisProps {
  incident: IncidentReport | null;
  allServices: ServiceNode[];
  onNavigateToRecommendations: (serviceId: string) => void;
}

export const IncidentAnalysis: React.FC<IncidentAnalysisProps> = ({
  incident,
  allServices,
  onNavigateToRecommendations,
}) => {
  if (!incident) {
    return (
      <div className="p-12 text-center rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-surface flex items-center justify-center text-slate-500 border border-surface-border">
          <Activity className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">No Active Incident Report</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          All microservices are currently operating within baseline parameters. Trigger a failure simulation or choose a Demo Scenario to generate a comprehensive risk and cascading failure analysis.
        </p>
      </div>
    );
  }

  const { riskBreakdown } = incident;

  const severityColor =
    incident.severity === 'CRITICAL'
      ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
      : incident.severity === 'HIGH'
      ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
      : incident.severity === 'MEDIUM'
      ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
      : 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

  return (
    <div className="space-y-6">
      {/* Incident Header Banner */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${severityColor}`}>
                <AlertOctagon className="w-4 h-4" />
                {incident.severity} SEVERITY
              </span>
              <span className="text-xs font-mono text-slate-400">ID: {incident.id}</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(incident.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Root Cause: Outage in <span className="text-rose-400">{incident.failedService.name}</span>
            </h2>
          </div>

          {/* Quick Mitigations Jump */}
          <button
            onClick={() => onNavigateToRecommendations(incident.failedService.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple/20 hover:bg-brand-purple/30 text-purple-300 text-xs font-bold border border-purple-500/40 transition-colors shadow-lg shadow-purple-950/20"
          >
            <Wrench className="w-4 h-4 text-purple-400" />
            View Suggested Mitigations ({incident.suggestedMitigationSteps.length})
          </button>
        </div>

        {/* Severity Reason */}
        <div className="p-4 rounded-xl bg-surface/70 border border-surface-border text-xs text-slate-300 leading-relaxed">
          <strong className="text-white font-semibold">Severity Assessment: </strong>
          {incident.severityReason}
        </div>
      </div>

      {/* Risk Scoring Breakdown Grid (Transparent Algorithm) */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Transparent Risk-Scoring Formula
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic scoring based on blast radius, tier hierarchy, synchronous critical RPCs, and state persistence.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-cyan-400">{riskBreakdown.compositeScore}</span>
            <span className="text-xs text-slate-400"> / 100 pts</span>
          </div>
        </div>

        {/* 4 Scoring Factor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-surface border border-surface-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">1. Blast Radius</span>
              <span className="font-mono font-bold text-white">{riskBreakdown.blastRadiusScore} / 35</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-1.5 rounded-full"
                style={{ width: `${(riskBreakdown.blastRadiusScore / 35) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {incident.affectedCount} of {incident.totalServices - 1} dependent services impacted.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-surface-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">2. Tier Criticality</span>
              <span className="font-mono font-bold text-white">{riskBreakdown.tierWeightScore} / 30</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-400 h-1.5 rounded-full"
                style={{ width: `${(riskBreakdown.tierWeightScore / 30) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Root Tier-{incident.failedService.tier} service weight + downstream victim tiers.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-surface-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">3. Critical Links</span>
              <span className="font-mono font-bold text-white">{riskBreakdown.criticalEdgeScore} / 20</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-1.5 rounded-full"
                style={{ width: `${(riskBreakdown.criticalEdgeScore / 20) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Synchronous blocking REST/RPC dependency paths broken.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-surface-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">4. Data Risk</span>
              <span className="font-mono font-bold text-white">{riskBreakdown.dataLossRiskScore} / 15</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-rose-400 h-1.5 rounded-full"
                style={{ width: `${(riskBreakdown.dataLossRiskScore / 15) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Database cluster or financial transaction state exposure.
            </p>
          </div>
        </div>
      </div>

      {/* Business Impact & Propagation Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Impact Analysis */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Estimated Business & User Impact
          </h3>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
            {incident.potentialBusinessImpact}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">Affected Downstream Services ({incident.affectedCount}):</span>
            {incident.affectedDownstreamServices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No downstream services affected. Isolated impact.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {incident.affectedDownstreamServices.map((service) => (
                  <div
                    key={service.id}
                    className="p-2.5 rounded-lg bg-surface/60 border border-surface-border text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-white block">{service.name}</span>
                      <span className="text-[10px] text-slate-400">Tier {service.tier} • {service.category}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      AFFECTED
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dependency Propagation Paths */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Downstream Failure Propagation Paths
          </h3>

          <p className="text-xs text-slate-400">
            Traced cascading paths from root fault to downstream caller endpoints:
          </p>

          {incident.dependencyPaths.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface/40 border border-surface-border text-xs text-slate-400 italic">
              No propagation paths detected. The failed service has no callers.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {incident.dependencyPaths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-surface/70 border border-surface-border text-xs flex items-center gap-2 flex-wrap"
                >
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">Path #{idx + 1}:</span>
                  {path.map((nodeId, nodeIdx) => (
                    <React.Fragment key={nodeId}>
                      <span
                        className={`px-2 py-1 rounded font-mono text-[11px] ${
                          nodeIdx === 0
                            ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                            : 'bg-surface-border text-slate-200 border border-slate-700'
                        }`}
                      >
                        {allServices.find(s => s.id === nodeId)?.name || nodeId}
                      </span>
                      {nodeIdx < path.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Actionable Mitigations */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Wrench className="w-4 h-4 text-purple-400" />
          Immediate Incident Mitigations
        </h3>

        <div className="space-y-2.5">
          {incident.suggestedMitigationSteps.map((step, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-start gap-3 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-brand-purple/20 text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <span className="text-slate-200 leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
