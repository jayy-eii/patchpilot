import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CheckCircle2, Loader2, Circle, XCircle, RefreshCw, Files, GitBranch, ArrowLeft } from 'lucide-react';
import { RepoAnalysis } from '../types/analysis';

/* ---------------- Custom minimal node ---------------- */

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  tsx: '#3178c6',
  javascript: '#f7df1e',
  jsx: '#f7df1e',
  python: '#3572A5',
  java: '#b07219',
  c: '#555555',
  cpp: '#f34b7d',
};

type FileNodeData = { label: string; language: string; selected: boolean };
function FileNodeView({ data }: { data: FileNodeData }) {
  const color = LANG_COLORS[data.language] || '#64748b';
  return (
    <div
      className={`px-3 py-2 rounded-lg border text-xs font-mono shadow-md transition-colors ${
        data.selected
          ? 'bg-cyan-950/60 border-cyan-400 text-white'
          : 'bg-surface-card border-surface-border text-slate-200 hover:border-cyan-500/50'
      }`}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#475569', width: 6, height: 6 }} />
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate max-w-[220px]" title={data.label}>{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#475569', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { fileNode: FileNodeView };

/* ---------------- Simple layered layout ---------------- */

function layoutNodes(
  nodes: { id: string; label: string; language: string }[],
  edges: { source: string; target: string }[]
): Map<string, { x: number; y: number }> {
  // Longest-path layering: node layer = longest chain of incoming edges
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }

  const layer = new Map<string, number>();
  const visiting = new Set<string>();

  const computeLayer = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const parents = incoming.get(id) || [];
    const l = parents.length === 0 ? 0 : Math.max(...parents.map(p => computeLayer(p))) + 1;
    visiting.delete(id);
    layer.set(id, l);
    return l;
  };

  nodes.forEach(n => computeLayer(n.id));

  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) || 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const COL = 300, ROW = 90;
  for (const [l, ids] of Array.from(byLayer.entries()).sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, i) => {
      positions.set(id, { x: l * COL, y: i * ROW });
    });
  }
  return positions;
}

/* ---------------- Progress steps ---------------- */

const ProgressSteps: React.FC<{ steps: { label: string; state: string }[] }> = ({ steps }) => (
  <div className="space-y-2 p-4 rounded-xl bg-surface-card border border-surface-border max-w-md mx-auto">
    {steps.map((s) => (
      <div key={s.label} className="flex items-center gap-2.5 text-sm">
        {s.state === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {s.state === 'active' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
        {s.state === 'pending' && <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
        <span className={s.state === 'active' ? 'text-cyan-300' : s.state === 'done' ? 'text-slate-300' : 'text-slate-500'}>
          {s.label}
        </span>
      </div>
    ))}
  </div>
);

/* ---------------- File detail panel ---------------- */

const FileDetailPanel: React.FC<{
  path: string;
  detail: { language: string; dependencies: string[]; usedBy: string[]; importSpecs: string[] };
  onClose: () => void;
  onSelectPath: (p: string) => void;
}> = ({ path, detail, onClose, onSelectPath }) => (
  <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-surface-card border-l border-surface-border shadow-2xl z-50 flex flex-col">
    <div className="p-4 border-b border-surface-border flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate" title={path}>{path.split('/').pop()}</div>
        <div className="text-[11px] font-mono text-slate-400 truncate">{path}</div>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none px-2">×</button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Type</div>
        <span className="font-mono text-cyan-300">{detail.language}</span>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Imports ({detail.importSpecs.length})</div>
        {detail.importSpecs.length === 0 ? (
          <p className="text-slate-500 italic">No imports detected.</p>
        ) : (
          <div className="space-y-1">
            {detail.importSpecs.map((s, i) => (
              <div key={i} className="px-2 py-1 rounded bg-surface font-mono text-[11px] text-slate-300 truncate" title={s}>{s}</div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Dependencies ({detail.dependencies.length})</div>
        {detail.dependencies.length === 0 ? (
          <p className="text-slate-500 italic">None detected.</p>
        ) : (
          <div className="space-y-1">
            {detail.dependencies.map((d) => (
              <button
                key={d}
                onClick={() => onSelectPath(d)}
                className="block w-full text-left px-2 py-1 rounded bg-surface hover:bg-surface-elevated font-mono text-[11px] text-purple-300 truncate"
                title={d}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Used By ({detail.usedBy.length})</div>
        {detail.usedBy.length === 0 ? (
          <p className="text-slate-500 italic">No files import this file.</p>
        ) : (
          <div className="space-y-1">
            {detail.usedBy.map((u) => (
              <button
                key={u}
                onClick={() => onSelectPath(u)}
                className="block w-full text-left px-2 py-1 rounded bg-surface hover:bg-surface-elevated font-mono text-[11px] text-amber-300 truncate"
                title={u}
              >
                {u}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

/* ---------------- Main component ---------------- */

interface RepositoryAnalyzerProps {
  analysis: RepoAnalysis | null;
  onBack: () => void;
  onAnalyzeAgain: () => void;
}

export const RepositoryAnalyzer: React.FC<RepositoryAnalyzerProps> = ({ analysis, onBack, onAnalyzeAgain }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPath(null);
  }, [analysis?.analysisId]);

  const flowNodes = useMemo<Node[]>(() => {
    if (!analysis || analysis.status !== 'complete') return [];
    const positions = layoutNodes(analysis.files, analysis.edges);
    return analysis.files.map((f) => ({
      id: f.id,
      type: 'fileNode',
      position: positions.get(f.id) || { x: 0, y: 0 },
      selected: selectedPath === f.id,
      data: { label: f.label, language: f.language, selected: selectedPath === f.id },
    }));
  }, [analysis, selectedPath]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!analysis || analysis.status !== 'complete') return [];
    return analysis.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: false,
      style: { stroke: '#475569', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
    }));
  }, [analysis]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedPath(node.id);
  }, []);

  if (!analysis) return null;

  const detail = selectedPath && analysis.details[selectedPath] ? analysis.details[selectedPath] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-surface-border text-xs text-slate-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Repos
          </button>
          <div>
            <h2 className="text-base font-bold text-white">{analysis.repo?.fullName}</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              {analysis.branch && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{analysis.branch}</span>}
              {analysis.stats && (
                <span className="flex items-center gap-1">
                  <Files className="w-3 h-3" />
                  {analysis.stats.detectedDependencies} deps · {analysis.stats.supportedFiles} files · {(analysis.stats.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {analysis.status === 'error' && (
        <div className="p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <div className="flex items-center gap-2 text-sm text-rose-300">
            <XCircle className="w-4 h-4" />
            <span>{analysis.error || 'Repository analysis failed. Please try again.'}</span>
          </div>
          <button
            onClick={onAnalyzeAgain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      )}

      {/* Running: progress */}
      {analysis.status === 'running' && (
        <div className="min-h-[400px] flex items-center justify-center">
          <ProgressSteps steps={analysis.progress} />
        </div>
      )}

      {/* Complete: graph */}
      {analysis.status === 'complete' && (
        <>
          {analysis.edges.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface-card border border-surface-border text-center text-sm text-slate-400">
              No dependencies detected in the supported source files.
            </div>
          ) : (
            <div className="relative w-full h-[640px] rounded-xl border border-surface-border bg-background overflow-hidden">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.2}
                maxZoom={2}
                proOptions={{ hideAttribution: false }}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#1e293b" />
                <Controls className="!bg-surface-card !border !border-surface-border !rounded-xl" />
                <MiniMap
                  nodeColor={(n) => LANG_COLORS[(n.data as FileNodeData)?.language] || '#64748b'}
                  maskColor="rgba(8, 12, 20, 0.75)"
                  className="!bg-surface-card !border !border-surface-border !rounded-xl"
                />
              </ReactFlow>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 z-10 px-3 py-2 rounded-lg bg-surface-card/95 border border-surface-border text-[10px] font-mono text-slate-400">
                A ➔ B means "A imports B" · click a node for details
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail slide-over */}
      {detail && selectedPath && (
        <FileDetailPanel
          path={selectedPath}
          detail={detail}
          onClose={() => setSelectedPath(null)}
          onSelectPath={(p) => setSelectedPath(p)}
        />
      )}
    </div>
  );
};
