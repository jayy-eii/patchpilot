import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Shield,
  FileCode,
  Tag,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { RepairRecommendation, ServiceNode } from '../types';

interface RepairRecommendationsProps {
  recommendations: RepairRecommendation[];
  selectedServiceId: string;
  allServices: ServiceNode[];
  onSelectService: (serviceId: string) => void;
}

export const RepairRecommendations: React.FC<RepairRecommendationsProps> = ({
  recommendations,
  selectedServiceId,
  allServices,
  onSelectService,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'PROPOSED' | 'PENDING_REVIEW' | 'VERIFIED'>>({});

  const handleCopy = (id: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStatusChange = (recId: string, newStatus: 'PROPOSED' | 'PENDING_REVIEW' | 'VERIFIED') => {
    setStatusOverrides(prev => ({ ...prev, [recId]: newStatus }));
  };

  const currentService = allServices.find(s => s.id === selectedServiceId) || allServices[0];

  return (
    <div className="space-y-6">
      {/* Header and Service Selector */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-brand-purple/20 text-purple-400 border border-purple-500/30">
                <Wrench className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Deterministic Repair Recommendations</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Domain-specific mitigations derived from transparent engineering rules (circuit breakers, exponential backoff with jitter, read-replica routing, dead-letter queues).
            </p>
          </div>

          {/* Service Selector Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-medium text-slate-400 shrink-0">Target Service:</span>
            <select
              value={selectedServiceId}
              onChange={(e) => onSelectService(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-surface border border-surface-border text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              {allServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notice on safety and verification */}
        <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Architectural Safety Guardrail:</strong> PatchPilot never modifies production files automatically. Recommendations remain labeled as <em>PROPOSED</em> until tested and marked as <em>VERIFIED</em> by an engineer.
          </span>
        </div>
      </div>

      {/* Recommendations Cards */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-surface-card border border-surface-border text-xs text-slate-400">
            No specific recommendations cataloged for this service.
          </div>
        ) : (
          recommendations.map((rec) => {
            const currentStatus = statusOverrides[rec.id] || rec.verificationStatus;

            return (
              <div
                key={rec.id}
                className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4 hover:border-slate-600 transition-colors"
              >
                {/* Title & Priority & Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          rec.priority === 'P0-CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : rec.priority === 'P1-HIGH'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {rec.serviceName}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{rec.title}</h3>
                  </div>

                  {/* Verification Status Selector */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <span className="text-[11px] text-slate-400 mr-1">Status:</span>
                    <button
                      onClick={() => handleStatusChange(rec.id, 'PROPOSED')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        currentStatus === 'PROPOSED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-surface text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Proposed
                    </button>
                    <button
                      onClick={() => handleStatusChange(rec.id, 'PENDING_REVIEW')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        currentStatus === 'PENDING_REVIEW'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-surface text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      In Review
                    </button>
                    <button
                      onClick={() => handleStatusChange(rec.id, 'VERIFIED')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        currentStatus === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-surface text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      Verified
                    </button>
                  </div>
                </div>

                {/* Problem & Proposed Mitigation Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-surface/60 border border-surface-border space-y-1.5">
                    <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">
                      Root Vulnerability / Problem
                    </span>
                    <p className="text-slate-300 leading-relaxed">{rec.problem}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface/60 border border-surface-border space-y-1.5">
                    <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider block">
                      Proposed Resilience Mitigation
                    </span>
                    <p className="text-slate-300 leading-relaxed">{rec.proposedMitigation}</p>
                  </div>
                </div>

                {/* Why It Helps */}
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
                  <strong className="text-slate-100 font-semibold">Why this mitigates cascading failure: </strong>
                  {rec.whyItHelps}
                </div>

                {/* Code Snippet (if available) */}
                {rec.implementationSnippet && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        Implementation Blueprint
                      </span>
                      <button
                        onClick={() => handleCopy(rec.id, rec.implementationSnippet)}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {copiedId === rec.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Snippet
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-xl bg-background border border-surface-border font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                      <code>{rec.implementationSnippet}</code>
                    </pre>
                  </div>
                )}

                {/* Tags */}
                {rec.tags && rec.tags.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <div className="flex flex-wrap gap-1.5">
                      {rec.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-surface-border text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
