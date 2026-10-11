import {
  GitHubService,
  GitHubApiError,
  GitHubRepoSummary,
} from './github-service';
import {
  analyzeRepository,
  buildFileDependencyEdges,
  FileAnalysisResult,
} from '../engine/dependency-detector';
import { detectLanguage } from './github-service';

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

export interface AnalysisProgressStep {
  label: string;
  state: 'pending' | 'active' | 'done';
}

export interface FileNode {
  id: string; // file path
  label: string; // basename for display
  dir: string; // directory for grouping
  language: string;
}

export interface FileDependencyEdge {
  id: string;
  source: string;
  target: string;
}

export interface FileDetail {
  path: string;
  language: string;
  /** resolved dependency file paths this file imports */
  dependencies: string[];
  /** files that import this file */
  usedBy: string[];
  /** raw import spec strings found in the file (decoded source text) */
  importSpecs: string[];
}

export interface RepoAnalysis {
  analysisId: string;
  status: AnalysisStatus;
  repo: GitHubRepoSummary | null;
  branch: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  progress: AnalysisProgressStep[];
  // Graph data (populated on completion)
  files: FileNode[];
  edges: FileDependencyEdge[];
  details: Record<string, FileDetail>; // keyed by file path
  stats: {
    totalScanned: number;
    supportedFiles: number;
    detectedDependencies: number;
    languages: Record<string, number>;
    durationMs: number;
  } | null;
}

/**
 * In-memory analysis store. MVP scope: one analysis at a time (server restart
 * resets). Designed so advanced features (simulations, test execution) can hang
 * off a completed RepoAnalysis later without changing this interface.
 */
export class AnalysisService {
  private static current: RepoAnalysis | null = null;

  static getCurrentAnalysis(): RepoAnalysis | null {
    return this.current;
  }

  static clearAnalysis(): void {
    this.current = null;
  }

  static startAnalysis(owner: string, repo: string, branch?: string, githubToken?: string): RepoAnalysis {
    const analysisId = `AN-${Date.now().toString(36).toUpperCase()}`;
    const startedAt = new Date().toISOString();

    const progress: AnalysisProgressStep[] = [
      { label: 'Reading repository structure', state: 'active' },
      { label: 'Detecting source files', state: 'pending' },
      { label: 'Analyzing imports', state: 'pending' },
      { label: 'Building dependency graph', state: 'pending' },
    ];

    this.current = {
      analysisId,
      status: 'running',
      repo: null,
      branch: branch || '',
      startedAt,
      completedAt: null,
      error: null,
      progress,
      files: [],
      edges: [],
      details: {},
      stats: null,
    };

    // Run async — client polls for status
    this.execute(analysisId, owner, repo, branch, githubToken).catch(err => {
      // last-resort guard (execute handles its own errors)
      if (this.current?.analysisId === analysisId && this.current.status === 'running') {
        this.current.status = 'error';
        this.current.error = 'Repository analysis failed. Please try again.';
        this.markProgressStep('Building dependency graph', 'done', analysisId);
      }
      console.error('[PatchPilot Analysis] Unexpected error:', err);
    });

    return this.current;
  }

  private static markProgressStep(label: string, state: 'pending' | 'active' | 'done', analysisId: string): void {
    const a = this.current;
    if (!a || a.analysisId !== analysisId) return;
    const step = a.progress.find(s => s.label === label);
    if (step) step.state = state;
  }

  private static async execute(analysisId: string, owner: string, repo: string, branch?: string, githubToken?: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1+2: repository structure + source files via ONE zipball download.
      // This keeps GitHub API usage at 2 calls per analysis (meta + zipball)
      // instead of 1 call per file, protecting the unauthenticated 60/hr limit.
      const zip = await GitHubService.fetchRepoZipball(owner, repo, githubToken, branch);
      if (this.current?.analysisId !== analysisId) return;

      this.current.repo = zip.repo;
      this.current.branch = zip.repo.defaultBranch;
      this.markProgressStep('Reading repository structure', 'done', analysisId);
      this.markProgressStep('Detecting source files', 'active', analysisId);

      const contents: Array<{ path: string; language: string; content: string }> = [];
      const languageCounts: Record<string, number> = {};
      for (const [path, content] of Object.entries(zip.contents)) {
        const language = detectLanguage(path);
        if (!language) continue;
        languageCounts[language] = (languageCounts[language] || 0) + 1;
        contents.push({ path, language, content });
      }

      if (contents.length > 3000) {
        throw new Error(
          `Repository too large for MVP analysis (${contents.length} supported source files, max 3000).`
        );
      }

      if (contents.length === 0) {
        throw new Error('No supported source files found in this repository.');
      }

      if (this.current?.analysisId !== analysisId) return;

      this.markProgressStep('Detecting source files', 'done', analysisId);
      this.markProgressStep('Analyzing imports', 'active', analysisId);

      // Step 3: import detection & relative-path resolution
      const analyses: FileAnalysisResult[] = analyzeRepository(contents);
      if (this.current?.analysisId !== analysisId) return;

      this.markProgressStep('Analyzing imports', 'done', analysisId);
      this.markProgressStep('Building dependency graph', 'active', analysisId);

      // Step 4: build graph
      const rawEdges = buildFileDependencyEdges(analyses);

      const participatingIds = new Set<string>();
      for (const e of rawEdges) {
        participatingIds.add(e.source);
        participatingIds.add(e.target);
      }

      const fileMap = new Map(analyses.map(a => [a.path, a]));
      const details: Record<string, FileDetail> = {};

      for (const id of participatingIds) {
        const a = fileMap.get(id);
        if (!a) continue;
        const dependencies = a.imports
          .map(i => i.resolvedPath)
          .filter((p): p is string => Boolean(p));
        const usedBy = analyses
          .filter(other => other.imports.some(i => i.resolvedPath === id))
          .map(other => other.path);

        details[id] = {
          path: a.path,
          language: a.language,
          dependencies: Array.from(new Set(dependencies)),
          usedBy: Array.from(new Set(usedBy)),
          importSpecs: a.importSpecs.filter(Boolean).slice(0, 30),
        };
      }

      const files: FileNode[] = Array.from(participatingIds)
        .filter(id => details[id])
        .map(id => {
          const pathParts = id.split('/');
          return {
            id,
            label: pathParts[pathParts.length - 1] || id,
            dir: pathParts.slice(0, -1).join('/') || '/',
            language: fileMap.get(id)!.language,
          };
        });

      const edgeList: FileDependencyEdge[] = rawEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      if (this.current?.analysisId !== analysisId) return;

      this.current.files = files;
      this.current.edges = edgeList;
      this.current.details = details;
      this.current.stats = {
        totalScanned: contents.length,
        supportedFiles: contents.length,
        detectedDependencies: edgeList.length,
        languages: languageCounts,
        durationMs: Date.now() - startTime,
      };
      this.current.status = 'complete';
      this.current.completedAt = new Date().toISOString();
      this.markProgressStep('Building dependency graph', 'done', analysisId);
    } catch (err: unknown) {
      if (this.current?.analysisId !== analysisId) return;

      let message = 'Repository analysis failed. Please try again.';
      if (err instanceof GitHubApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      this.current.status = 'error';
      this.current.error = message;
      this.current.completedAt = new Date().toISOString();
    }
  }
}
