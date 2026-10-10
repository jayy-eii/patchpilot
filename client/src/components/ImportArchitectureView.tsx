import React, { useState } from 'react';
import {
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  Check,
  Code2,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ServiceNode, DependencyEdge } from '../types';

interface ImportArchitectureViewProps {
  currentServices: ServiceNode[];
  currentDependencies: DependencyEdge[];
  onImport: (payload: any) => Promise<void>;
  onRestoreSample: () => Promise<void>;
  onExport: () => Promise<void>;
  loading: boolean;
}

const SAMPLE_TEMPLATE_JSON = `{
  "services": [
    { "id": "web-portal", "name": "Web Customer Portal", "criticality": "tier-1" },
    { "id": "auth-service", "name": "User Auth Provider", "criticality": "tier-1" },
    { "id": "payment-api", "name": "Payment Gateway API", "criticality": "tier-1" },
    { "id": "shipping-svc", "name": "Shipping Logistics", "criticality": "tier-2" },
    { "id": "email-worker", "name": "Email Dispatcher", "criticality": "tier-3" }
  ],
  "dependencies": [
    { "from": "web-portal", "to": "auth-service" },
    { "from": "web-portal", "to": "payment-api" },
    { "from": "payment-api", "to": "shipping-svc" },
    { "from": "shipping-svc", "to": "email-worker" }
  ]
}`;

export const ImportArchitectureView: React.FC<ImportArchitectureViewProps> = ({
  currentServices,
  currentDependencies,
  onImport,
  onRestoreSample,
  onExport,
  loading,
}) => {
  const [jsonInput, setJsonInput] = useState<string>(SAMPLE_TEMPLATE_JSON);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      setValidationErrors([]);
      setSuccessMessage(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setValidationErrors([]);
    setSuccessMessage(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (err: any) {
      setValidationErrors([`JSON Syntax Error: ${err.message}`]);
      return;
    }

    try {
      await onImport(parsed);
      setSuccessMessage('Architecture successfully validated and imported! Graph, simulator, and risk scoring now reflect your imported topology.');
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else {
        setValidationErrors([err.message || 'Validation failed.']);
      }
    }
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(SAMPLE_TEMPLATE_JSON);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Bring-Your-Own Architecture (Import)</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Import custom microservice architectures via JSON. PatchPilot validates IDs, node references, self-loops, and updates the graph visualization, failure simulator, and risk scorer.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={loading}
              onClick={onExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-surface-border transition-colors shadow-md"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              Export Graph as JSON
            </button>

            <button
              disabled={loading}
              onClick={onRestoreSample}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-md"
            >
              <RotateCcw className="w-4 h-4 text-purple-400" />
              Restore E-Commerce Graph
            </button>
          </div>
        </div>

        {/* Current Active Graph Stat */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-4 text-xs text-slate-400">
          <span>Active Architecture: <strong className="text-white">{currentServices.length} Services</strong></span>
          <span>•</span>
          <span>Active Dependencies: <strong className="text-white">{currentDependencies.length} Edges</strong></span>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Validation Errors Panel */}
      {validationErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Validation Failed ({validationErrors.length} Issue{validationErrors.length > 1 ? 's' : ''}):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-rose-200 pl-1 font-mono text-[11px]">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* JSON Schema Definition & Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area (2 columns) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              Paste or Edit Architecture JSON
            </h3>
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-300 text-xs font-medium border border-surface-border cursor-pointer transition-colors">
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setJsonInput(SAMPLE_TEMPLATE_JSON)}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-300 text-xs font-medium border border-surface-border transition-colors"
              >
                Reset Template
              </button>
            </div>
          </div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={14}
            className="w-full p-4 rounded-xl bg-background border border-surface-border text-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 leading-relaxed"
            placeholder="Paste your architecture JSON here..."
          />

          <button
            disabled={loading}
            onClick={handleImport}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-purple hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            Validate & Import Architecture
          </button>
        </div>

        {/* Format Specification Guide (1 column) */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              JSON Schema Specification
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your JSON must contain two top-level arrays: <code>services</code> and <code>dependencies</code>.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
                <span className="font-mono text-cyan-300 font-bold block mb-1">services: [ ... ]</span>
                <span className="text-[11px] text-slate-400 block">• <code>id</code> (string, unique)</span>
                <span className="text-[11px] text-slate-400 block">• <code>name</code> (string, display name)</span>
                <span className="text-[11px] text-slate-400 block">• <code>criticality</code> ("tier-1", "tier-2", "tier-3")</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
                <span className="font-mono text-cyan-300 font-bold block mb-1">dependencies: [ ... ]</span>
                <span className="text-[11px] text-slate-400 block">• <code>from</code> (source service ID)</span>
                <span className="text-[11px] text-slate-400 block">• <code>to</code> (target service ID)</span>
                <span className="text-[11px] text-slate-400 block mt-1 italic">Meaning: <strong>from depends on to</strong></span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={handleCopyTemplate}
              className="w-full py-2 px-3 rounded-lg bg-surface hover:bg-slate-700 text-xs font-mono text-slate-300 border border-surface-border flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedTemplate ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Template
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Sample Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
