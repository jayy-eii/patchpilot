import React from 'react';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Server,
  Layers,
  Clock,
  Wrench,
} from 'lucide-react';
import { ServiceNode, DependencyEdge } from '../types';

interface ServiceDetailModalProps {
  service: ServiceNode | null;
  allServices: ServiceNode[];
  dependencies: DependencyEdge[];
  onClose: () => void;
  onSimulate: (serviceId: string) => void;
  onReset: () => void;
  onViewRecommendations: (serviceId: string) => void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  allServices,
  dependencies,
  onClose,
  onSimulate,
  onReset,
  onViewRecommendations,
}) => {
  if (!service) return null;

  const serviceMap = new Map(allServices.map(s => [s.id, s]));

  // Services this service calls (Outbound: source = service.id)
  const outboundDependencies = dependencies
    .filter(d => d.source === service.id)
    .map(d => ({
      edge: d,
      targetService: serviceMap.get(d.target),
    }));

  // Services that call this service (Inbound: target = service.id, i.e., dependents)
  const inboundDependents = dependencies
    .filter(d => d.target === service.id)
    .map(d => ({
      edge: d,
      sourceService: serviceMap.get(d.source),
    }));

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-surface-card border-l border-surface-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-5 border-b border-surface-border flex items-center justify-between bg-surface/70">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-border text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">{service.name}</h3>
            <span className="text-xs font-mono text-slate-400">ID: {service.id}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-border transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Status & Tier Banner */}
        <div className="p-4 rounded-xl bg-surface/60 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Operational Status</span>
            {service.status === 'healthy' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy & Operational
              </span>
            )}
            {service.status === 'failed' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                <XCircle className="w-3.5 h-3.5" /> Root Simulated Failure
              </span>
            )}
            {service.status === 'affected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5" /> Affected Downstream Victim
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-slate-400 block text-[11px]">Criticality Tier</span>
              <span className="font-semibold text-white">Tier {service.tier} ({service.tier === 1 ? 'Mission Critical' : service.tier === 2 ? 'Core Supporting' : 'Auxiliary Leaf'})</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-slate-400 block text-[11px]">SLA Availability</span>
              <span className="font-semibold text-emerald-400 font-mono">{service.healthMetric}%</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">Description</h4>
          <p className="text-xs text-slate-300 leading-relaxed bg-surface/30 p-3 rounded-lg border border-surface-border/50">
            {service.description}
          </p>
        </div>

        {/* Metadata Details */}
        {service.metadata && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">System Specs</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-surface/40 border border-surface-border/40">
                <span className="text-slate-400 text-[11px] block">Owner Team</span>
                <span className="text-white font-medium">{service.metadata.team || 'Core Infra'}</span>
              </div>
              <div className="p-2 rounded bg-surface/40 border border-surface-border/40">
                <span className="text-slate-400 text-[11px] block">Runtime Stack</span>
                <span className="text-white font-mono text-[11px]">{service.metadata.runtime || 'Containerized'}</span>
              </div>
              <div className="p-2 rounded bg-surface/40 border border-surface-border/40">
                <span className="text-slate-400 text-[11px] block">Protocol</span>
                <span className="text-white font-mono text-[11px]">{service.metadata.protocol || 'HTTP'}</span>
              </div>
              <div className="p-2 rounded bg-surface/40 border border-surface-border/40">
                <span className="text-slate-400 text-[11px] block">Latency Budget</span>
                <span className="text-cyan-400 font-mono text-[11px]">{service.metadata.maxLatencyMs} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Inbound Callers / Dependents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Services Dependent on This ({inboundDependents.length})
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            If this service fails, these caller services are immediately impacted:
          </p>
          {inboundDependents.length === 0 ? (
            <div className="p-3 rounded-lg bg-surface/30 border border-surface-border text-xs text-slate-400 italic">
              No services depend on this node (Leaf consumer). An outage here will NOT cascade upstream.
            </div>
          ) : (
            <div className="space-y-2">
              {inboundDependents.map(({ edge, sourceService }) => (
                <div
                  key={edge.id}
                  className="p-2.5 rounded-lg bg-surface/50 border border-surface-border text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white">{sourceService?.name || edge.source}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{edge.description}</span>
                  </div>
                  {edge.critical && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      CRITICAL
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outbound Dependencies */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            Outbound Dependencies ({outboundDependencies.length})
          </h4>
          <p className="text-[11px] text-slate-400 mb-2">
            This service relies on the following backend providers:
          </p>
          {outboundDependencies.length === 0 ? (
            <div className="p-3 rounded-lg bg-surface/30 border border-surface-border text-xs text-slate-400 italic">
              No outbound dependencies (Root persistence tier).
            </div>
          ) : (
            <div className="space-y-2">
              {outboundDependencies.map(({ edge, targetService }) => (
                <div
                  key={edge.id}
                  className="p-2.5 rounded-lg bg-surface/50 border border-surface-border text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white">{targetService?.name || edge.target}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{edge.description}</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                    {edge.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-surface-border bg-surface/90 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {service.status === 'failed' ? (
            <button
              onClick={() => onReset()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              Reset Simulation
            </button>
          ) : (
            <button
              onClick={() => onSimulate(service.id)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition-colors"
            >
              <Play className="w-4 h-4" />
              Simulate Failure
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onViewRecommendations(service.id);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-purple/20 hover:bg-brand-purple/30 text-purple-300 text-xs font-semibold transition-colors border border-purple-500/40"
          >
            <Wrench className="w-4 h-4 text-purple-400" />
            Mitigations
          </button>
        </div>
      </div>
    </div>
  );
};
