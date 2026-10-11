import { Router, Request, Response } from 'express';
import { AnalysisService, RepoAnalysis } from '../services/analysis-service';
import { GitHubService, GitHubApiError } from '../services/github-service';

/**
 * Repositories & Analysis API routes:
 *   GET  /api/repos/status              → current connection / analysis state
 *   GET  /api/repos?username=<user>     → list a user's public repos (real GitHub data)
 *   POST /api/repos/analyze             → start analysis of owner/repo (async)
 *   GET  /api/repos/analysis            → poll status + fetch graph when done
 *   DELETE /api/repos/analysis          → clear current analysis
 */

/**
 * Optional runtime override for the GitHub token (from the UI).
 * Kept in-memory only — never persisted, never returned to the client.
 */
let runtimeToken: string | null = null;
export const setRuntimeToken = (token: string | null) => { runtimeToken = token; };
export const getRuntimeToken = () => runtimeToken;

const sanitizeAnalysis = (a: RepoAnalysis) => ({
  analysisId: a.analysisId,
  status: a.status,
  repo: a.repo,
  branch: a.branch,
  startedAt: a.startedAt,
  completedAt: a.completedAt,
  error: a.error,
  progress: a.progress,
  files: a.files,
  edges: a.edges,
  details: a.details,
  stats: a.stats,
});

export const createReposRouter = (getToken: () => string | null = () => runtimeToken): Router => {
  const router = Router();

  // Connection status — includes live GitHub rate-limit remaining count.
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      // Probe GitHub API liveness and read rate-limit headers (no extra API call needed).
      const activeToken = getRuntimeToken() || process.env.GITHUB_TOKEN || undefined;
      const probe = await fetch('https://api.github.com/rate_limit', {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      });
      if (!probe.ok) {
        return res.json({ success: true, data: { connected: false, api: 'github-public', message: 'GitHub API unreachable.', rateLimitRemaining: null } });
      }
      const data = await probe.json();
      const remaining = data?.resources?.core?.remaining ?? null;
      const limit = data?.resources?.core?.limit ?? null;
      const resetAt = data?.resources?.core?.reset ? new Date(data.resources.core.reset * 1000).toISOString() : null;
      res.json({
        success: true,
        data: {
          connected: true,
          api: 'github-public',
          message: 'Connected to GitHub public API.',
          rateLimitRemaining: remaining,
          rateLimitLimit: limit,
          rateLimitResetAt: resetAt,
        },
      });
    } catch (err) {
      const message = err instanceof GitHubApiError ? err.message : 'GitHub API unreachable.';
      res.json({ success: true, data: { connected: false, api: 'github-public', message, rateLimitRemaining: null } });
    }
  });

  // List a user's public repositories (real GitHub data)
  router.get('/', async (req: Request, res: Response) => {
    const username = String(req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ success: false, error: 'A GitHub username is required (?username=<user>).' });
    }
    try {
      const repos = await GitHubService.fetchUserRepos(username, getToken() || undefined);
      res.json({ success: true, data: repos, total: repos.length });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        const status = err.status === 403 ? 429 : err.status === 404 ? 404 : 502;
        return res.status(status).json({ success: false, error: err.message });
      }
      console.error('[PatchPilot Repos] GitHub fetch failed:', err);
      return res.status(502).json({ success: false, error: 'Unable to reach GitHub. Check your connection and try again.' });
    }
  });

  // Start an analysis (async; poll /analysis for progress)
  router.post('/analyze', async (req: Request, res: Response) => {
    const { owner, repo, branch } = req.body || {};
    if (typeof owner !== 'string' || typeof repo !== 'string' || !owner.trim() || !repo.trim()) {
      return res.status(400).json({ success: false, error: "'owner' and 'repo' are required string fields." });
    }
    try {
      GitHubService.validateOwnerRepo(owner.trim(), repo.trim());

      // Rate-limit-friendly analyze flow: the codeload ZIP download is not
      // rate-limited, so we start the analysis directly and let the pipeline
      // gather metadata through it (or via rate-limited metadata if available).
      const analysis = AnalysisService.startAnalysis(
        owner.trim(),
        repo.trim(),
        typeof branch === 'string' && branch.trim() ? branch.trim() : undefined,
        getToken() || undefined
      );
      res.json({ success: true, data: sanitizeAnalysis(analysis) });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        const status = err.status === 403 ? 429 : err.status === 404 ? 404 : 502;
        return res.status(status).json({ success: false, error: err.message });
      }
      console.error('[PatchPilot Repos] analyze failed:', err);
      return res.status(500).json({ success: false, error: 'Repository analysis failed. Please try again.' });
    }
  });

  // Set a GitHub token at runtime (server-memory only; boosts limit 60→5000/hr).
  router.post('/token', (req: Request, res: Response) => {
    const { token } = req.body || {};
    if (token !== null && token !== undefined && typeof token !== 'string') {
      return res.status(400).json({ success: false, error: "'token' must be a string or null." });
    }
    setRuntimeToken(token && token.trim() ? token.trim() : null);
    res.json({ success: true, data: { message: runtimeToken ? 'GitHub token saved for this server session.' : 'GitHub token cleared.' } });
  });

  // Whether a runtime token is present (never returns the token itself).
  router.get('/token', (_req: Request, res: Response) => {
    res.json({ success: true, data: { tokenPresent: Boolean(getRuntimeToken()) } });
  });

  // Poll / fetch current analysis
  router.get('/analysis', (_req: Request, res: Response) => {
    const current = AnalysisService.getCurrentAnalysis();
    if (!current) {
      return res.status(404).json({ success: false, error: 'No analysis has been run yet.' });
    }
    res.json({ success: true, data: sanitizeAnalysis(current) });
  });

  // Clear the current analysis
  router.delete('/analysis', (_req: Request, res: Response) => {
    AnalysisService.clearAnalysis();
    res.json({ success: true, data: { message: 'Analysis cleared.' } });
  });

  return router;
};
