export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  visibility: 'public' | 'private';
  language: string | null;
  lastUpdated: string;
  defaultBranch: string;
}

export interface AnalysisProgressStep {
  label: string;
  state: 'pending' | 'active' | 'done';
}

export interface AnalysisFileNode {
  id: string;
  label: string;
  dir: string;
  language: string;
}

export interface AnalysisEdge {
  id: string;
  source: string;
  target: string;
}

export interface FileDetail {
  path: string;
  language: string;
  dependencies: string[];
  usedBy: string[];
  importSpecs: string[];
}

export interface RepoAnalysis {
  analysisId: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  repo: {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    visibility: string;
    language: string | null;
    lastUpdated: string;
    defaultBranch: string;
  } | null;
  branch: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  progress: AnalysisProgressStep[];
  files: AnalysisFileNode[];
  edges: AnalysisEdge[];
  details: Record<string, FileDetail>;
  stats: {
    totalScanned: number;
    supportedFiles: number;
    detectedDependencies: number;
    languages: Record<string, number>;
    durationMs: number;
  } | null;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  api: string;
  message: string;
  rateLimitRemaining?: number | null;
  rateLimitLimit?: number | null;
  rateLimitResetAt?: string | null;
}
