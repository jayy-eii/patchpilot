import React from 'react';
import { Sparkles, Github, Layers, ArrowLeft } from 'lucide-react';

interface NavbarProps {
  activeView: string;
  onViewChange: (view: 'repos' | 'analysis') => void;
  repoName: string | null;
  analysisStatus: 'idle' | 'running' | 'complete' | 'error' | null;
}

const statusLabel: Record<string, string> = {
  running: 'Analyzing',
  complete: 'Analyzed',
  error: 'Error',
};

export const Navbar: React.FC<NavbarProps> = ({ activeView, onViewChange, repoName, analysisStatus }) => (
  <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-xl border-b border-surface-border">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-brand-purple flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">PatchPilot</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Repository Dependency Mapper</p>
          </div>
        </div>

        {/* Flow indicator: Repo → Analysis → Graph */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => onViewChange('repos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeView === 'repos'
                ? 'bg-surface text-cyan-300 border border-surface-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> Repository
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => repoName && onViewChange('analysis')}
            disabled={!repoName}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40 ${
              activeView === 'analysis'
                ? 'bg-surface text-cyan-300 border border-surface-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeView === 'analysis' && <ArrowLeft className="w-3.5 h-3.5" />}
            <Layers className="w-3.5 h-3.5" />
            Dependency Graph
            {analysisStatus && analysisStatus !== 'idle' && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  analysisStatus === 'running'
                    ? 'bg-amber-950/60 text-amber-400'
                    : analysisStatus === 'complete'
                    ? 'bg-emerald-950/60 text-emerald-400'
                    : 'bg-rose-950/60 text-rose-400'
                }`}
              >
                {statusLabel[analysisStatus]}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  </header>
);
