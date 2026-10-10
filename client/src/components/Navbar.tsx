import React from 'react';
import {
  Activity,
  Layers,
  Flame,
  AlertOctagon,
  Wrench,
  FileCheck,
  BookOpen,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Upload,
  Target,
} from 'lucide-react';
import { SimulationResult, ServiceNode } from '../types';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  activeSimulation: SimulationResult | null;
  onResetSimulation: () => void;
  failedCount: number;
  affectedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  activeSimulation,
  onResetSimulation,
  failedCount,
  affectedCount,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'map', label: 'Dependency Map', icon: Layers },
    { id: 'simulator', label: 'Failure Simulator', icon: Flame },
    { id: 'analysis', label: 'Smarter Analysis', icon: Target },
    { id: 'incident', label: 'Incident Analysis', icon: AlertOctagon },
    { id: 'recommendations', label: 'Mitigations', icon: Wrench },
    { id: 'import', label: 'Import Architecture', icon: Upload },
    { id: 'tests', label: 'Test Results', icon: FileCheck },
    { id: 'docs', label: 'Architecture & Docs', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Branding & Status Row */}
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-brand-purple flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
                  PatchPilot
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                  MVP v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                AI-Powered Software Failure Detective
              </p>
            </div>
          </div>

          {/* Center/Right Status & Quick Action */}
          <div className="flex items-center gap-3">
            {failedCount > 0 ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Outage Simulated: {affectedCount} Affected</span>
                </div>
                <button
                  onClick={onResetSimulation}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-surface-border transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  Reset
                </button>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Baseline Nominal (All Healthy)</span>
                <span className="sm:hidden">Nominal</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-surface text-cyan-300 border border-surface-border shadow-sm shadow-cyan-950/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                {tab.label}
                {tab.id === 'incident' && failedCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
