/**
 * PatchPilot GitHub Service
 * Integrates with the public GitHub REST API v3 (https://api.github.com).
 * Public repos only for the MVP. GITHUB_TOKEN is optional and used ONLY for
 * higher rate limits — it is never sent to the frontend.
 */

import { inflateRawSync } from 'zlib';

const GITHUB_API_BASE = 'https://api.github.com';

const githubHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
};

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

export interface AnalysisFile {
  path: string;
  size: number;
  language: string;
}

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

export interface RepoFetchResult {
  repo: GitHubRepoSummary;
  sha: string;
  files: AnalysisFile[];
}

export interface RepoZipResult {
  repo: GitHubRepoSummary;
  /** Repo file contents keyed by repo-relative path (leading "<repo>-<sha>/" prefix stripped) */
  contents: Record<string, string>;
}

export class GitHubService {
  /** Thrown when GitHub cannot be reached / rate limit / not found. */
  static isNotFoundError(err: unknown): boolean {
    return err instanceof GitHubApiError && err.status === 404;
  }

  static async fetchRepoMeta(owner: string, repo: string, token?: string): Promise<GitHubRepoSummary> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers: githubHeaders(token) });
    if (!res.ok) {
      if (res.status === 404) throw new GitHubApiError(404, `Repository '${owner}/${repo}' not found or is private.`);
      if (res.status === 403) throw new GitHubApiError(403, 'GitHub rate limit exceeded. Try again later.');
      throw new GitHubApiError(res.status, `GitHub API error ${res.status}.`);
    }
    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner.login,
      visibility: data.private ? 'private' : 'public',
      language: data.language,
      lastUpdated: data.pushed_at || data.updated_at,
      defaultBranch: data.default_branch,
    };
  }

  static async fetchUserRepos(githubUsername: string, token?: string): Promise<GitHubRepoSummary[]> {
    const res = await fetch(`${GITHUB_API_BASE}/users/${githubUsername}/repos?per_page=100&sort=pushed`, {
      headers: githubHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 404) throw new GitHubApiError(404, `GitHub user '${githubUsername}' not found.`);
      if (res.status === 403) throw new GitHubApiError(403, 'GitHub rate limit exceeded. Try again later.');
      throw new GitHubApiError(res.status, `GitHub API error ${res.status}.`);
    }
    const data = (await res.json()) as Array<Record<string, any>>;
    return data.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      visibility: r.private ? 'private' : 'public',
      language: r.language,
      lastUpdated: r.pushed_at || r.updated_at,
      defaultBranch: r.default_branch,
    }));
  }

  /**
   * Fetches repo metadata + full non-recursive-cached file tree (recursive=1) and
   * filters to supported source-language files (JS/TS/JSX/TSX/Py/Java/C/C++).
   */
  static async fetchRepoTree(owner: string, repo: string, token?: string, branch?: string): Promise<RepoFetchResult> {
    let resolvedBranch = branch;
    const repoMeta = await this.fetchRepoMeta(owner, repo, token);
    if (!resolvedBranch) resolvedBranch = repoMeta.defaultBranch;

    const treeRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${resolvedBranch}?recursive=1`,
      { headers: githubHeaders(token) }
    );
    if (!treeRes.ok) {
      if (treeRes.status === 404) throw new GitHubApiError(404, `Branch or repository tree not found for '${owner}/${repo}'.`);
      throw new GitHubApiError(treeRes.status, `GitHub API error ${treeRes.status}.`);
    }
    const treeData = await treeRes.json();
    const items: GitHubTreeItem[] = treeData.tree || [];

    const files: AnalysisFile[] = [];
    for (const item of items) {
      if (item.type !== 'blob') continue;
      const language = detectLanguage(item.path);
      if (!language) continue;
      files.push({ path: item.path, size: item.size || 0, language });
    }

    return { repo: repoMeta, sha: treeData.sha, files };
  }

  /**
   * Rate-limit-efficient path: downloads the entire repo snapshot as ONE zipball
   * request and extracts supported source files in memory (ZIP entries are
   * STORED or DEFLATE — both handled here without external dependencies).
   */
  static async fetchRepoZipball(owner: string, repo: string, token?: string, branch?: string): Promise<RepoZipResult> {
    let repoMeta: GitHubRepoSummary | null = null;
    let ref = branch || '';

    if (!ref) {
      // codeload.github.com needs a ref: use the cached default branch via metadata,
      // or fall back to 'HEAD' when we are rate-limited (metadata call fails with 403).
      try {
        repoMeta = await this.fetchRepoMeta(owner, repo, token);
        ref = repoMeta.defaultBranch;
      } catch (err) {
        if (err instanceof GitHubApiError && err.status === 403) {
          // Rate-limited: codeload.githubusercontent.com is NOT rate-limited.
          // Fall back to bundling metadata locally from the ZIP contents below.
          ref = 'HEAD';
        } else {
          throw err;
        }
      }
    }

    // Primary: codeload.github.com (NOT subject to API rate limits)
    // Secondary fallback: api.github.com zipball (rate-limited, keeps working when codeload is blocked).
    let res = await fetch(`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(ref || 'HEAD')}`, {
      headers: githubHeaders(token),
      redirect: 'follow',
    });
    if (res.status === 404 || res.status === 403) {
      res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/zipball/${encodeURIComponent(ref || 'HEAD')}`, {
        headers: githubHeaders(token),
        redirect: 'follow',
      });
    }
    if (!res.ok) {
      if (res.status === 404) throw new GitHubApiError(404, `Repository or branch not found for '${owner}/${repo}'.`);
      if (res.status === 403) throw new GitHubApiError(403, 'GitHub rate limit exceeded. Try again later.');
      throw new GitHubApiError(res.status, `GitHub API error ${res.status}.`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // If we skipped metadata (rate-limited path), rebuild a summary from ZIP paths
    if (!repoMeta) {
      repoMeta = {
        id: 0,
        name: repo,
        fullName: `${owner}/${repo}`,
        owner,
        visibility: 'public',
        language: null,
        lastUpdated: new Date().toISOString(),
        defaultBranch: ref || 'main',
      };
    }

    // Zip entries are prefixed with "<repo>-<short-sha>/" — strip the first path segment.
    const entries = unzipInMemory(buffer);
    const contents: Record<string, string> = {};
    for (const [entryPath, data] of Object.entries(entries)) {
      const stripped = entryPath.split('/').slice(1).join('/');
      if (!stripped) continue;
      const language = detectLanguage(stripped);
      if (!language) continue;
      const text = data.toString('utf-8');
      if (text.length <= 500_000) {
        contents[stripped] = text;
      }
    }

    if (Object.keys(contents).length === 0) {
      throw new GitHubApiError(422, 'No supported source files found in this repository.');
    }

    return { repo: repoMeta, contents };
  }

  /** Fetch a single file's raw content (base64 decoded). */
  static async fetchFileContent(owner: string, repo: string, filePath: string, token?: string): Promise<string> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: githubHeaders(token),
    });
    if (!res.ok) {
      throw new GitHubApiError(res.status, `Failed to fetch file '${filePath}': GitHub API error ${res.status}.`);
    }
    const data = await res.json();
    if (data.encoding !== 'base64') {
      throw new GitHubApiError(500, `Unexpected encoding for file '${filePath}'.`);
    }
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  /** Sanitize settings used to construct GitHub URLs from user input. */
  static validateOwnerRepo(owner: string, repo: string): void {
    if (!/^[A-Za-z0-9-_.]+$/.test(owner)) throw new GitHubApiError(400, 'Invalid GitHub owner name.');
    if (!/^[A-Za-z0-9-_.]+$/.test(repo)) throw new GitHubApiError(400, 'Invalid GitHub repository name.');
  }
}

export class GitHubApiError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Inline helper shared with the analysis pipeline */
export function detectLanguage(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  if (/(^|\/)(node_modules|dist|build|out|target|vendor|\.venv|venv|__pycache__|\.git|coverage)\//.test(lower)) return null;
  if (/\.(min\.js|bundle\.js|d\.ts)$/.test(lower)) return null;
  if (/\.(ts|mts|cts)$/.test(lower)) return 'typescript';
  if (/\.(tsx)$/.test(lower)) return 'tsx';
  if (/\.(js|mjs|cjs)$/.test(lower)) return 'javascript';
  if (/\.jsx$/.test(lower)) return 'jsx';
  if (/\.py$/.test(lower)) return 'python';
  if (/\.java$/.test(lower)) return 'java';
  if (/\.(c|h)$/.test(lower)) return 'c';
  if (/\.(cc|cpp|cxx|hpp|hh|hxx)$/.test(lower)) return 'cpp';
  return null;
}

/* --------------------------------------------------------------------------
 * Minimal in-memory ZIP reader (STORE + DEFLATE support, no dependencies).
 * Extracted from the ZIP central-directory format:
 *  - End of Central Directory record (EOCD) located via its signature
 *  - Per-file Central Directory headers give offsets to Local File Headers
 *  - Local header is followed by the compressed payload
 * ------------------------------------------------------------------------ */

interface ZipEntry {
  compressedSize: number;
  uncompressedSize: number;
  method: number; // 0 = stored, 8 = deflate
  dataOffset: number;
}

/** Minimal in-memory ZIP reader — exported for testing. */
export function unzipInMemory(buffer: Buffer): Record<string, Buffer> {
  const files: Record<string, Buffer> = {};

  // Locate End of Central Directory (signature 0x06054b50, may be followed by comment)
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new GitHubApiError(502, 'Could not parse repository archive.');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);

  let ptr = cdOffset;
  for (let n = 0; n < entryCount; n++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break; // central dir signature
    const method = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const uncompressedSize = buffer.readUInt32LE(ptr + 24);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString('utf-8', ptr + 46, ptr + 46 + nameLen);

    // Parse the local file header to find where data actually starts
    if (buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const lNameLen = buffer.readUInt16LE(localOffset + 26);
      const lExtraLen = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + lNameLen + lExtraLen;

      const entry: ZipEntry = { compressedSize, uncompressedSize, method, dataOffset };
      const extracted = extractEntry(buffer, entry);
      if (extracted && !name.endsWith('/')) {
        files[name] = extracted;
      }
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function extractEntry(buffer: Buffer, entry: ZipEntry): Buffer | null {
  const raw = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) {
    return Buffer.from(raw); // stored
  }
  if (entry.method === 8) {
    try {
      return inflateRawSync(raw);
    } catch {
      return null;
    }
  }
  return null;
}
