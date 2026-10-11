import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { RepositoryExplorer } from './components/RepositoryExplorer';
import { RepositoryAnalyzer } from './components/RepositoryAnalyzer';
import { api } from './api/client';
import { GitHubRepoSummary, GitHubConnectionStatus, RepoAnalysis } from './types/analysis';

/**
 * Parse user input into a GitHub target.
 * Accepts: "jayy-eii" | "jayy-eii/patchpilot" | "https://github.com/jayy-eii/patchpilot"
 * Returns { username } for listing, or { owner, repo } for a direct analysis.
 */
const parseGitHubInput = (raw: string): { username?: string; owner?: string; repo?: string } => {
  const input = raw.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const urlMatch = /^(?:https?:\/\/)?github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(input);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const pairMatch = /^([\w.-]+)\/([\w.-]+)$/.exec(input);
  if (pairMatch) return { owner: pairMatch[1], repo: pairMatch[2] };
  if (/^[\w.-]+$/.test(input)) return { username: input };
  return {};
};
import { ServerCrash, RefreshCw } from 'lucide-react';

type View = 'repos' | 'analysis';

export const App: React.FC = () => {
  const [view, setView] = useState<View>('repos');
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [connection, setConnection] = useState<GitHubConnectionStatus | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [analyzingRepo, setAnalyzingRepo] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastRepo, setLastRepo] = useState<{ owner: string; repo: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Probe backend + GitHub connectivity on load
  useEffect(() => {
    api.getConnectionStatus()
      .then(setConnection)
      .catch(() => {
        setConnectionError(
          'Unable to connect to PatchPilot backend. Ensure the server is running with `npm run dev`.'
        );
      });
    // Restore an in-progress analysis after page reload
    api.getAnalysis()
      .then((a) => {
        if (a && (a.status === 'running' || a.status === 'complete')) {
          setAnalysis(a);
          if (a.status === 'complete') setView('analysis');
        }
      })
      .catch(() => undefined);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const current = await api.getAnalysis();
        setAnalysis(current);
        if (current.status === 'complete' || current.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setAnalyzingRepo(null);
          if (current.status === 'complete') setView('analysis');
        }
      } catch {
        // analysis cleared server-side
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setAnalyzingRepo(null);
      }
    }, 1200);
  }, []);

  const handleFetchRepos = useCallback(async (rawInput: string) => {
    setReposLoading(true);
    setReposError(null);

    const parsed = parseGitHubInput(rawInput);

    // Direct repo URL / owner-repo shorthand → skip listing, analyze immediately
    if (parsed.owner && parsed.repo) {
      try {
        const started = await api.analyzeRepo(parsed.owner, parsed.repo);
        setAnalysis(started);
        setAnalyzingRepo(`${parsed.owner}/${parsed.repo}`);
        startPolling();
      } catch (err: any) {
        setReposError(err.message || 'Repository analysis failed. Please try again.');
      }
      finally {
        setReposLoading(false);
      }
      return;
    }

    if (!parsed.username) {
      setReposError('Enter a GitHub username, an owner/repo pair, or a github.com repository URL.');
      setReposLoading(false);
      return;
    }

    try {
      const list = await api.getRepos(parsed.username);
      setRepos(list);
      if (list.length === 0) {
        setReposError(`No public repositories found for '${parsed.username}'.`);
      }
    } catch (err: any) {
      setRepos([]);
      setReposError(err.message || 'Unable to fetch repositories. Check the username and try again.');
    } finally {
      setReposLoading(false);
    }
  }, [startPolling]);

  const handleAnalyze = useCallback(
    async (repo: GitHubRepoSummary) => {
      try {
        setAnalyzingRepo(repo.fullName);
        setConnectionError(null);
        setLastRepo({ owner: repo.owner, repo: repo.name });
        const started = await api.analyzeRepo(repo.owner, repo.name);
        setAnalysis(started);
        startPolling();
      } catch (err: any) {
        setAnalyzingRepo(null);
        setReposError(err.message || 'Repository analysis failed. Please try again.');
      }
    },
    [startPolling]
  );

  // After a runtime token is saved, re-probe status so the budget display updates
  const handleTokenSet = useCallback(async () => {
    try {
      const status = await api.getConnectionStatus();
      setConnection(status);
    } catch {
      // keep previous status
    }
  }, []);

  const handleAnalyzeAgain = useCallback(() => {
    if (!lastRepo) return;
    handleAnalyze({
      id: 0,
      name: lastRepo.repo,
      fullName: `${lastRepo.owner}/${lastRepo.repo}`,
      owner: lastRepo.owner,
      visibility: 'public',
      language: null,
      lastUpdated: new Date().toISOString(),
      defaultBranch: 'main',
    });
  }, [lastRepo, handleAnalyze]);

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      <Navbar
        activeView={view}
        onViewChange={setView}
        repoName={analysis?.repo?.fullName || null}
        analysisStatus={analysis?.status || null}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {connectionError && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-between gap-4 text-xs shadow-xl">
            <div className="flex items-center gap-3 text-rose-300">
              <ServerCrash className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{connectionError}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-200 font-semibold border border-surface-border transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Retry
            </button>
          </div>
        )}

        {view === 'repos' && (
          <RepositoryExplorer
            repos={repos}
            connection={connection}
            loading={reposLoading}
            error={reposError}
            onFetchRepos={handleFetchRepos}
            onAnalyze={handleAnalyze}
            analyzingRepo={analyzingRepo}
            onTokenSet={handleTokenSet}
          />
        )}

        {view === 'analysis' && (
          <RepositoryAnalyzer
            analysis={analysis}
            onBack={() => setView('repos')}
            onAnalyzeAgain={handleAnalyzeAgain}
          />
        )}
      </main>

      <footer className="border-t border-surface-border bg-surface/30 py-6 text-center text-xs text-slate-500">
        <p>PatchPilot — Repository Dependency Mapper MVP</p>
      </footer>
    </div>
  );
};

export default App;
