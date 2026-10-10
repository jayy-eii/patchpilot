import React from 'react';
import {
  BookOpen,
  GitBranch,
  ShieldAlert,
  Cpu,
  Layers,
  Terminal,
  ExternalLink,
  Code2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const DocumentationView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Intro Header */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            PatchPilot Architecture & Technical Documentation
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          PatchPilot is an AI-powered developer tool for detecting and simulating cascading failures in microservice architectures before they impact production workloads.
        </p>
      </div>

      {/* 1. Core Graph Dependency Model */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          1. Dependency Direction & Failure Propagation Model
        </h3>

        <div className="p-4 rounded-xl bg-surface/70 border border-surface-border text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Distributed systems have two complementary dimensions: <strong>Functional Dependency</strong> (who calls whom) and <strong>Failure Cascade</strong> (how outages ripple).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-lg bg-background border border-surface-border space-y-1">
              <span className="text-[11px] font-bold text-cyan-400 font-mono block">
                Functional Dependency Edge: A ➔ B
              </span>
              <p className="text-[11px] text-slate-400">
                Service A depends on Service B to function (e.g. Order Service calls Payment Service). In React Flow, edges point from Caller (Source) to Callee (Target).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-background border border-surface-border space-y-1">
              <span className="text-[11px] font-bold text-rose-400 font-mono block">
                Failure Cascade Direction: B ➔ A
              </span>
              <p className="text-[11px] text-slate-400">
                If Callee B crashes, failure propagates backwards along the dependency tree to Caller A, and transitively to any edge caller relying on A.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Transparent Risk Scoring Formula */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          2. Transparent Risk-Scoring Formula (0-100 Points)
        </h3>

        <div className="p-4 rounded-xl bg-surface/70 border border-surface-border text-xs text-slate-300 space-y-4 leading-relaxed">
          <p>
            Unlike opaque neural networks, PatchPilot uses a deterministic, rule-based mathematical scoring model:
          </p>

          <div className="p-3.5 rounded-lg bg-background border border-surface-border font-mono text-xs text-cyan-300 overflow-x-auto">
            <code>Risk Score = BlastRadius (0-35) + TierWeight (0-30) + CriticalEdges (0-20) + DataLoss (0-15)</code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="font-bold text-white block mb-0.5">Blast Radius Factor (0-35 pts)</span>
              <span className="text-slate-400 text-[11px]">
                Computed as (Affected Victims / Max Potential Victims) × 35. Measures % of overall system paralyzed.
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="font-bold text-white block mb-0.5">Tier Criticality Weight (0-30 pts)</span>
              <span className="text-slate-400 text-[11px]">
                Tier-1 failed root adds 18 pts; each downstream Tier-1 victim adds +4 pts; Tier-2 adds +2 pts (capped at 30).
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="font-bold text-white block mb-0.5">Critical Edge Severance (0-20 pts)</span>
              <span className="text-slate-400 text-[11px]">
                Counts synchronous blocking RPC/REST edges broken along active propagation paths (5 pts per severed link).
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="font-bold text-white block mb-0.5">Persistence & Ledger Risk (0-15 pts)</span>
              <span className="text-slate-400 text-[11px]">
                Database cluster outages score 15 pts; financial transaction services (Payment) score 12 pts; shopping carts score 10 pts.
              </span>
            </div>
          </div>

          {/* Severity Thresholds */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-white block mb-2">Severity Classification Boundaries:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-center">
                LOW: 0 – 24 pts
              </div>
              <div className="p-2 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-center">
                MEDIUM: 25 – 49 pts
              </div>
              <div className="p-2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-center">
                HIGH: 50 – 79 pts
              </div>
              <div className="p-2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-center">
                CRITICAL: 80 – 100 pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Demo Scenarios */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          3. Verified Demo Scenarios
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-surface/60 border border-surface-border space-y-1">
            <div className="flex items-center justify-between">
              <strong className="text-white font-semibold">Scenario A: Payment Service Outage</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                HIGH SEVERITY
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Demonstrates downstream cascade: Order Service and Notification Service fail. Cascades to API Gateway. Leaves Auth Service, Inventory Service, and Database healthy.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface/60 border border-surface-border space-y-1">
            <div className="flex items-center justify-between">
              <strong className="text-white font-semibold">Scenario B: Database Cluster Crash</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 font-bold">
                CRITICAL SEVERITY
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Catastrophic persistence failure. Auth, Order, Inventory, Payment, API Gateway, and Notifications all fail. Blast radius: 85%+.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface/60 border border-surface-border space-y-1">
            <div className="flex items-center justify-between">
              <strong className="text-white font-semibold">Scenario C: Notification Service Failure</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                LOW SEVERITY
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Isolated leaf node failure. Zero upstream services are affected. Confirms that callers are NOT falsely marked as victims.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Automated Testing & CLI Reference */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          4. Command-Line Interface & Testing
        </h3>

        <div className="p-4 rounded-xl bg-background border border-surface-border space-y-3 font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]"># Run the full Vitest automated test suite</span>
            <code className="text-cyan-300 font-semibold">$ npm test --workspace=server</code>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]"># Start both backend (port 3001) and frontend (port 5173) in dev mode</span>
            <code className="text-purple-300 font-semibold">$ npm run dev</code>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]"># Build both client and server for production</span>
            <code className="text-emerald-300 font-semibold">$ npm run build</code>
          </div>
        </div>
      </div>
    </div>
  );
};
