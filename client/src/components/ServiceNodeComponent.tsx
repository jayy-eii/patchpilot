import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Shield,
  CreditCard,
  Database,
  Bell,
  ShoppingCart,
  Box,
  Network,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Info,
} from 'lucide-react';
import { ServiceNode } from '../types';
import { Tooltip } from './Tooltip';

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'network':
      return <Network className="w-4 h-4 text-cyan-400" />;
    case 'shield':
      return <Shield className="w-4 h-4 text-purple-400" />;
    case 'shopping-cart':
      return <ShoppingCart className="w-4 h-4 text-blue-400" />;
    case 'box':
      return <Box className="w-4 h-4 text-amber-400" />;
    case 'credit-card':
      return <CreditCard className="w-4 h-4 text-emerald-400" />;
    case 'database':
      return <Database className="w-4 h-4 text-indigo-400" />;
    case 'bell':
      return <Bell className="w-4 h-4 text-pink-400" />;
    default:
      return <Activity className="w-4 h-4 text-slate-400" />;
  }
};

export const ServiceNodeComponent: React.FC<NodeProps> = memo(({ data, selected }) => {
  const service = data.service as ServiceNode;
  const isFailed = service.status === 'failed';
  const isAffected = service.status === 'affected';
  const isHealthy = service.status === 'healthy';

  let borderColor = 'border-surface-border hover:border-slate-500';
  let glowStyle = 'bg-surface-card';
  let statusBadge = (
    <Tooltip content="Green / Healthy: Service is fully operational and meeting its SLA.">
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" /> Healthy
      </span>
    </Tooltip>
  );

  if (isFailed) {
    borderColor = 'border-rose-500 ring-2 ring-rose-500/40 animate-pulse';
    glowStyle = 'bg-rose-950/40 shadow-lg shadow-rose-950/60';
    statusBadge = (
      <Tooltip content="Red / Root Failure: This service was injected with simulated outage.">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40 animate-pulse">
          <XCircle className="w-3 h-3 text-rose-400" /> FAILED
        </span>
      </Tooltip>
    );
  } else if (isAffected) {
    borderColor = 'border-amber-500 ring-1 ring-amber-500/30';
    glowStyle = 'bg-amber-950/30 shadow-md shadow-amber-950/40';
    statusBadge = (
      <Tooltip content="Amber / Affected: Downstream dependent knocked offline because an upstream service it relies on has failed.">
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 text-amber-400" /> AFFECTED
        </span>
      </Tooltip>
    );
  }

  if (selected) {
    borderColor += ' ring-2 ring-cyan-400';
  }

  return (
    <div
      className={`relative min-w-[220px] max-w-[260px] rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${borderColor} ${glowStyle}`}
      title={`Click to inspect ${service.name}`}
    >
      {/* Target handle (receives connections) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-background"
      />

      {/* Header with Icon, Name, and Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-surface-border/50 border border-slate-700/60">
            {getCategoryIcon(service.icon)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight leading-tight">
              {service.name}
            </h4>
            <span className="text-[10px] font-mono uppercase text-slate-400">
              Tier-{service.tier} • {service.category}
            </span>
          </div>
        </div>
      </div>

      {/* Description Snippet */}
      <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed">
        {service.description}
      </p>

      {/* Footer metadata */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <span className="text-[10px] font-mono text-slate-400">
          Uptime <span className="text-slate-200 font-semibold">{service.healthMetric}%</span>
        </span>
        {statusBadge}
      </div>

      {/* Source handle (outbound connections) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-background"
      />
    </div>
  );
});

ServiceNodeComponent.displayName = 'ServiceNodeComponent';
