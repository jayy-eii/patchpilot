import React, { useState, useCallback, useEffect } from 'react';
import { Github, Search, Lock, Globe, FileCode2, RefreshCw, ArrowRight, KeyRound, Timer } from 'lucide-react';
import { api } from '../api/client';
import { GitHubRepoSummary, GitHubConnectionStatus } from '../types/analysis';

interface RepositoryExplorerProps {
  repos: GitHubRepoSummary[];
  connection: GitHubConnectionStatus | null;
  loading: boolean;
  error: string | null;
  onFetchRepos: (input: string) => void;
  onAnalyze: (repo: GitHubRepoSummary) => void;
  analyzingRepo: string | null;
  onTokenSet: () => void;
}

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const formatCountdown = (resetAtIso: string | null | undefined): string | null => {
  if (!resetAtIso) return null;
  const ms = new Date(resetAtIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export const RepositoryExplorer: React.FC<RepositoryExplorerProps> = ({
  repos,
  connection,
  loading,
  error,
  onFetchRepos,
  onAnalyze,
  analyzingRepo,
  onTokenSet,
}) => {
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState<string | null>(null);

  // Live countdown to the next rate-limit reset
  useEffect(() => {
    if (!connection?.rateLimitResetAt) {
      setResetCountdown(null);
      return;
    }
    const tick = () => setResetCountdown(formatCountdown(connection.rateLimitResetAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connection?.rateLimitResetAt]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) onFetchRepos(input.trim());
    },
    [input, onFetchRepos]
  );

  const handleSaveToken = useCallback(async () => {
    setTokenSaved(null);
    try {
      const res = await api.setGithubToken(token.trim() || null);
      setTokenSaved(res.message);
      setToken('');
      onTokenSet();
    } catch {
      setTokenSaved('Could not save token. Is the server running?');
    }
  }, [token, onTokenSet]);

  const isRateLimited = (connection?.rateLimitRemaining ?? 1) === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step 1: Connect */}
      <section className="p-5 rounded-xl bg-surface-card border border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <Github className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">1. Connect to GitHub</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="username, owner/repo, or repo URL (e.g. jayy-eii/patchpilot)"
            className="flex-1 px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Fetch Repos
          </button>
        </form>

        {/* Connection / rate-limit status line */}
        {connection && (
          <div className="mt-2 text-[11px] font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={connection.connected ? 'text-slate-500' : 'text-rose-400'}>{connection.message}</span>
            {connection.rateLimitRemaining != null && (
              <span className={isRateLimited ? 'text-rose-400' : 'text-emerald-400/80'}>
                · API budget: {connection.rateLimitRemaining}/{connection.rateLimitLimit ?? 60}
              </span>
            )}
            {isRateLimited && resetCountdown && (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <Timer className="w-3 h-3" /> resets in {resetCountdown}
              </span>
            )}
          </div>
        )}

        {/* Optional runtime token (server memory only) */}
        <div className="mt-3 pt-3 border-t border-surface-border/60">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Optional GitHub token — lifts limit to 5,000/hr (stored server-side only)"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveToken}
              disabled={!token.trim()}
              className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-cyan-900/40 disabled:opacity-40 border border-surface-border text-xs font-semibold text-cyan-300 transition-colors"
            >
              Save Token
            </button>
          </div>
          {tokenSaved && <p className="mt-1.5 text-[11px] text-emerald-400/80 font-mono">{tokenSaved}</p>}
        </div>
      </section>

      {/* Step 2: Select repository */}
      <section className="p-5 rounded-xl bg-surface-card border border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">2. Select a repository to analyze</h2>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 space-y-1">
            <p>{error}</p>
            {/rate limit/i.test(error) && (
              <p className="text-rose-400/70">
                Paste a GitHub token above to keep going now, or wait for the hourly reset.
              </p>
            )}
          </div>
        )}

        {!loading && !error && repos.length === 0 && (
          <p className="text-xs text-slate-500">
            No repositories loaded yet. Enter a username above — or paste a repo URL to analyze it directly.
          </p>
        )}

        <div className="space-y-2">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-surface border border-surface-border hover:border-cyan-500/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{repo.fullName}</span>
                  {repo.visibility === 'public' ? (
                    <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>{repo.visibility}</span>
                  {repo.language && <span className="text-purple-300">{repo.language}</span>}
                  <span>updated {formatRelativeTime(repo.lastUpdated)}</span>
                </div>
              </div>

              <button
                onClick={() => onAnalyze(repo)}
                disabled={analyzingRepo !== null}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  analyzingRepo === repo.fullName
                    ? 'bg-surface-border text-slate-300'
                    : 'bg-surface-elevated hover:bg-cyan-900/40 text-cyan-300 border border-surface-border'
                } disabled:opacity-50`}
              >
                {analyzingRepo === repo.fullName ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                Analyze
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
