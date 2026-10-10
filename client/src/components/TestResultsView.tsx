import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Terminal,
  Clock,
  ShieldCheck,
  FileCheck,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { TestSuiteSummary } from '../types';

interface TestResultsViewProps {
  testResults: TestSuiteSummary | null;
  onRunTests: () => Promise<void>;
  loading: boolean;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  testResults,
  onRunTests,
  loading,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText('npm test --workspace=server');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const isAllPassed = testResults ? testResults.failed === 0 && testResults.passed > 0 : false;

  return (
    <div className="space-y-6">
      {/* Test Runner Header */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Automated Test Verification Runner</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real automated test suite executing Vitest. Rigorously verifies downstream traversal, isolated leaves, cyclic graphs, missing node resilience, risk scoring boundaries, and deterministic repair recommendations.
            </p>
          </div>

          {/* Trigger live test run */}
          <button
            disabled={loading}
            onClick={onRunTests}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-lg shadow-cyan-950/40"
          >
            {loading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Executing Vitest Runner...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Execute Vitest Suite Now
              </>
            )}
          </button>
        </div>

        {/* Stats Row */}
        {testResults && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-surface border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Total Automated Tests</span>
              <span className="text-xl font-bold font-mono text-white">{testResults.total}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Passing Tests</span>
              <span className="text-xl font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {testResults.passed}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Failing Tests</span>
              <span className="text-xl font-bold font-mono text-rose-400 flex items-center gap-1.5">
                {testResults.failed > 0 && <XCircle className="w-4 h-4" />} {testResults.failed}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Suite Duration</span>
              <span className="text-xl font-bold font-mono text-cyan-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {testResults.durationMs} ms
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Command Card */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Terminal Execution Instructions
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">CLI Verification</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <span className="text-cyan-400 font-bold">$</span>
            <code>npm test --workspace=server</code>
          </div>
          <button
            onClick={handleCopyCmd}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            {copiedCmd ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          You can run this exact command from the project root at any time to verify the 21 unit & integration test assertions directly.
        </p>
      </div>

      {/* Test Cases Table */}
      <div className="rounded-2xl bg-surface-card border border-surface-border overflow-hidden shadow-xl">
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Verified Test Assertions ({testResults?.testCases?.length || 0})
            </h3>
          </div>
          {testResults && (
            <span className="text-[11px] font-mono text-slate-400">
              Last executed: {new Date(testResults.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/90 text-slate-400 font-mono text-[11px] uppercase border-b border-surface-border">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Test Case Description</th>
                <th className="py-3 px-4">Test Suite File</th>
                <th className="py-3 px-4 text-right">Execution Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {testResults?.testCases?.map((tc, idx) => (
                <tr key={idx} className="hover:bg-surface/40 transition-colors">
                  <td className="py-3 px-4">
                    {tc.status === 'passed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    {tc.name}
                    {tc.errorMessage && (
                      <p className="text-[10px] font-mono text-rose-400 mt-1">{tc.errorMessage}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-cyan-300">
                    {tc.suite}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400">
                    {tc.durationMs} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
