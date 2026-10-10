import React, { useMemo, useCallback } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ServiceNode, DependencyEdge } from '../types';
import { ServiceNodeComponent } from './ServiceNodeComponent';
import {
  RotateCcw,
  Maximize2,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface DependencyGraphProps {
  services: ServiceNode[];
  dependencies: DependencyEdge[];
  selectedService: ServiceNode | null;
  onSelectService: (service: ServiceNode | null) => void;
  onResetSimulation: () => void;
  isSimulating: boolean;
}

const nodeTypes = {
  serviceNode: ServiceNodeComponent,
};

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  services,
  dependencies,
  selectedService,
  onSelectService,
  onResetSimulation,
  isSimulating,
}) => {
  // Map services into React Flow nodes
  const flowNodes: Node[] = useMemo(() => {
    return services.map(service => ({
      id: service.id,
      type: 'serviceNode',
      position: service.position,
      selected: selectedService?.id === service.id,
      data: {
        service,
      },
    }));
  }, [services, selectedService]);

  // Map dependencies into React Flow edges
  // Semantics: Source depends on Target
  const flowEdges: Edge[] = useMemo(() => {
    const serviceStatusMap = new Map(services.map(s => [s.id, s.status]));

    return dependencies.map(dep => {
      const sourceStatus = serviceStatusMap.get(dep.source);
      const targetStatus = serviceStatusMap.get(dep.target);

      const isTargetFailed = targetStatus === 'failed';
      const isSourceAffected = sourceStatus === 'affected';
      const isPathBroken = isTargetFailed || (sourceStatus === 'failed');

      let edgeColor = '#475569'; // default slate-600
      let animated = false;

      if (isTargetFailed) {
        edgeColor = '#ef4444'; // Red for severed critical dependency
        animated = true;
      } else if (isSourceAffected) {
        edgeColor = '#f59e0b'; // Amber for degraded affected flow
        animated = true;
      }

      return {
        id: dep.id,
        source: dep.source,
        target: dep.target,
        type: 'smoothstep',
        animated,
        style: {
          stroke: edgeColor,
          strokeWidth: isPathBroken ? 2.8 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 14,
          height: 14,
        },
        label: dep.type === 'db-query' ? 'SQL Query' : dep.type === 'async-event' ? 'Async Event' : 'Sync REST',
        labelStyle: {
          fill: isTargetFailed ? '#fca5a5' : isSourceAffected ? '#fcd34d' : '#94a3b8',
          fontWeight: 500,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        },
        labelBgStyle: {
          fill: '#0f172a',
          fillOpacity: 0.85,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    });
  }, [dependencies, services]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync state whenever props change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const found = services.find(s => s.id === node.id);
      if (found) {
        onSelectService(found);
      }
    },
    [services, onSelectService]
  );

  const handlePaneClick = useCallback(() => {
    onSelectService(null);
  }, [onSelectService]);

  return (
    <div className="relative w-full h-[640px] md:h-[720px] rounded-2xl border border-surface-border bg-background overflow-hidden shadow-2xl">
      {/* Top action toolbar overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2.5">
        <div className="px-3 py-1.5 rounded-lg bg-surface-card/90 backdrop-blur-md border border-surface-border text-xs text-slate-300 font-medium flex items-center gap-2 shadow-lg">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Interactive Service Topology</span>
          <span className="text-[11px] font-mono text-slate-400">({services.length} Nodes)</span>
        </div>

        {isSimulating && (
          <button
            onClick={onResetSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 backdrop-blur-md border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-lg hover:shadow-cyan-950/30"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            Reset Baseline
          </button>
        )}
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#1e293b" />
        <Controls className="!bg-surface-card !border !border-surface-border !rounded-xl !p-1 !shadow-xl [&>button]:!bg-surface [&>button]:!border-surface-border [&>button]:!text-slate-300 hover:[&>button]:!text-white" />
        <MiniMap
          nodeColor={(node) => {
            const service = services.find(s => s.id === node.id);
            if (service?.status === 'failed') return '#ef4444';
            if (service?.status === 'affected') return '#f59e0b';
            return '#10b981';
          }}
          maskColor="rgba(8, 12, 20, 0.75)"
          className="!bg-surface-card !border !border-surface-border !rounded-xl overflow-hidden !shadow-xl"
        />
      </ReactFlow>

      {/* Floating State Legend */}
      <div className="absolute bottom-4 left-4 z-10 max-w-sm p-3.5 rounded-xl bg-surface-card/95 backdrop-blur-md border border-surface-border shadow-2xl text-xs space-y-2">
        <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
          <span>Legend & Dependency Semantics</span>
          <Info className="w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30 animate-pulse" />
            <span>Root Fail</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
            <span>Affected</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 leading-snug">
          <span className="text-slate-300 font-medium">Edge Direction: </span>
          <code className="text-cyan-300 font-mono">Service A ➔ Service B</code> indicates A calls/depends on B. If B fails, failure cascades back to A.
        </div>
      </div>
    </div>
  );
};
