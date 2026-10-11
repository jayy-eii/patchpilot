/**
 * PatchPilot Dependency Detection Engine
 *
 * Extracts import/dependency relationships from real source code files.
 * Returns the regexes used and the language name for each supported language,
 * which is enough info to rebuild the graph deterministically.
 */

export interface DetectedImport {
  /** The raw module/source string extracted from the import statement */
  spec: string;
  /** Whether it is a relative path like ./foo or ../foo/bar */
  isRelative: boolean;
  /** Will be resolved to a repo file path if isRelative and findable in the file set */
  resolvedPath: string | null;
}

export interface FileAnalysisResult {
  path: string;
  language: string;
  imports: DetectedImport[];
  /** Raw spec strings of every import (for display in the details panel, decoded) */
  importSpecs: string[];
}

export type ExtractorFn = (content: string) => string[];

const ALWAYS_SKIP = /(^|\/)(node_modules|dist|build|out|target|vendor|\.venv|venv|__pycache__|\.git|coverage|min\.js|bundle\.js)/i;

/* ---------- Extractors per language ------------------------------------- */

const extractJsTs: ExtractorFn = (content) => {
  const specs: string[] = [];
  const patterns: RegExp[] = [
    // import ... from 'module'  /  import 'module'
    /import\s+(?:[\w*\s,{}$]*\s+from\s+)?['"]([^'"]+)['"]/g,
    // const x = require('module')
    /(?:const|let|var)\s+(?:[\w{},*\s$]+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g,
    // export ... from 'module'
    /export\s+(?:[\w*\s,{}$]*\s+from\s+)?['"]([^'"]+)['"]/g,
    // dynamic import('module')
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      specs.push(m[1]);
    }
  }
  return specs;
};

const extractPython: ExtractorFn = (content) => {
  const specs: string[] = [];
  const patterns: RegExp[] = [
    // from .mod import x / from mod.sub import y
    /^\s*from\s+([.\w]+)\s+import\s+/gm,
    // import mod / import mod.sub
    /^\s*import\s+([.\w]+(?:\s*,\s*[.\w]+)*)/gm,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      // "import a, b" produces "a, b" — split
      const parts = m[1].split(',').map(s => s.trim());
      for (const part of parts) specs.push(part);
    }
  }
  return specs;
};

const extractJava: ExtractorFn = (content) => {
  const specs: string[] = [];
  const p = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
  let m;
  while ((m = p.exec(content)) !== null) {
    specs.push(m[1]);
  }
  return specs;
};

const extractCLocal: ExtractorFn = (content) => {
  const specs: string[] = [];
  let m;
  const local = /#include\s+"([^"]+)"/g;
  while ((m = local.exec(content)) !== null) {
    specs.push(m[1]);
  }
  return specs;
};

/* ---------- Module registry (modular — add languages here) --------------- */

export const LANGUAGE_EXTRACTORS: Record<string, ExtractorFn> = {
  javascript: extractJsTs,
  jsx: extractJsTs,
  typescript: extractJsTs,
  tsx: extractJsTs,
  python: extractPython,
  java: extractJava,
  c: extractCLocal,
  cpp: extractCLocal,
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_EXTRACTORS);

/* ---------- Path resolution --------------------------------------------- */

/** Normalize a POSIX path (handles ./ and ../ segments) */
export function normalizePath(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

/**
 * Resolve a bare/relative import spec to a repo file path.
 *
 * For relative specs (./foo, ../bar/baz): try exact, then with common extensions
 * (.ts, .tsx, .js, .jsx, .py, .mjs, .cjs, /index.ts, /index.js, etc).
 *
 * For Python modules (a.b.c): try a/b/c.py (relative to same dir as importer),
 * then a/b/c/__init__.py.
 *
 * For Java imports (com.foo.bar.Baz): try Baz.java / baz.java anywhere in the file set,
 * matched by classname == file basename.
 *
 * For C/C++ (#include "local.h"): try exact path relative to the importing file's dir.
 */
export function resolveImportSpec(
  importerPath: string,
  spec: string,
  repoFiles: string[]
): { isRelative: boolean; resolvedPath: string | null } {
  const fileSet = new Set(repoFiles);
  const lowerFileSet = new Set(repoFiles.map(f => f.toLowerCase()));

  const tryCandidates = (candidates: string[]): string | null => {
    for (const cand of candidates) {
      if (fileSet.has(cand)) return cand;
      // case-insensitive match (GitHub paths are case sensitive, but git trees can
      // have mixed case — best effort)
      const lc = cand.toLowerCase();
      if (lowerFileSet.has(lc)) {
        const found = repoFiles.find(f => f.toLowerCase() === lc);
        if (found) return found;
      }
    }
    return null;
  };

  // --- Relative JS/TS or C/C++ style: starts with ./ or ../ or is a quoted C header
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const base = normalizePath(joinPosix(dirname(importerPath), spec));
    const exact = tryCandidates([base]);
    if (exact) return { isRelative: true, resolvedPath: exact };

    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];
    const withExts = exts.map(e => base + e);
    const indexVariants = exts.map(e => `${base}/index${e}`);
    const found = tryCandidates([...withExts, ...indexVariants]);
    return { isRelative: true, resolvedPath: found };
  }

  // --- C/C++ local include: #include "header.h" — relative to importer dir
  if (/\.(h|hpp|hh|hxx|c|cc|cpp)$/i.test(importerPath) && !spec.startsWith('<')) {
    const base = normalizePath(joinPosix(dirname(importerPath), spec));
    const found = tryCandidates([base, spec]);
    if (found) return { isRelative: true, resolvedPath: found };
    return { isRelative: true, resolvedPath: null };
  }

  // --- Python: relative (from .mod import) or absolute module path
  if (/\.py$/.test(importerPath) && /^[.\w]/.test(spec)) {
    // relative python: leading dots mean "go up"
    const relMatch = /^(\.+)([\w.]*)$/.exec(spec);
    if (relMatch) {
      const dots = relMatch[1].length;
      const modulePath = relMatch[2].split('.').join('/');
      let dir = dirname(importerPath);
      for (let i = 1; i < dots; i++) dir = dirname(dir);
      const base = modulePath ? normalizePath(joinPosix(dir, modulePath)) : dir;
      const found = tryCandidates([`${base}.py`, `${base}/__init__.py`]);
      if (found) return { isRelative: true, resolvedPath: found };
      return { isRelative: true, resolvedPath: null };
    }
    // absolute python module (e.g. `import services.payment`): match by module path
    const moduleBase = spec.split('.').join('/');
    // try relative to importer first: services/payment.py from src/services/x.py → src/services/payment.py
    const dir = dirname(importerPath);
    const localGuess = normalizePath(joinPosix(dir, moduleBase));
    const found = tryCandidates([`${localGuess}.py`, `${localGuess}/__init__.py`, `${moduleBase}.py`, `${moduleBase}/__init__.py`]);
    if (found) return { isRelative: true, resolvedPath: found };
    return { isRelative: false, resolvedPath: null };
  }

  // --- Java: fully-qualified classname com.foo.bar.Baz → find Baz.java by basename
  if (/\.java$/.test(importerPath) && /^[\w.]+$/.test(spec)) {
    const className = spec.split('.').pop() || '';
    if (className && className !== '*') {
      const candidates = repoFiles.filter(f => {
        const base = (f.split('/').pop() || '').toLowerCase();
        return base === `${className.toLowerCase()}.java`;
      });
      if (candidates.length === 1) return { isRelative: true, resolvedPath: candidates[0] };
      return { isRelative: true, resolvedPath: candidates[0] || null };
    }
    return { isRelative: true, resolvedPath: null };
  }

  // else non-relative or unresolved (e.g. npm bare packages, python site-packages)
  return { isRelative: false, resolvedPath: null };
}

/* ---------- Node path helpers (POSIX-flavored) --------------------------- */

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function joinPosix(a: string, b: string): string {
  if (!a) return b.replace(/^\.\//, '');
  return `${a}/${b}`;
}

/* ---------- File analysis ------------------------------------------------ */

export function analyzeFileContent(path: string, language: string, content: string): FileAnalysisResult {
  const extractor = LANGUAGE_EXTRACTORS[language];
  if (!extractor) {
    return { path, language, imports: [], importSpecs: [] };
  }

  const rawSpecs = extractor(content);
  const seen = new Set<string>();
  const imports: DetectedImport[] = [];

  for (const spec of rawSpecs) {
    if (!spec || ALWAYS_SKIP.test(spec)) continue;
    if (seen.has(spec)) continue;
    seen.add(spec);
    const { isRelative, resolvedPath } = resolveImportSpec(path, spec, []);
    imports.push({
      spec,
      isRelative,
      resolvedPath,
    });
  }

  return { path, language, imports, importSpecs: rawSpecs };
}

/**
 * Analyze a whole repository: second pass with full file set so relative
 * resolution can actually find files. Returns file-level analyses with
 * resolvedPath populated.
 */
export function analyzeRepository(
  files: Array<{ path: string; language: string; content: string }>
): FileAnalysisResult[] {
  const repoFilePaths = files.map(f => f.path);
  const results: FileAnalysisResult[] = [];

  for (const file of files) {
    const extractor = LANGUAGE_EXTRACTORS[file.language];
    if (!extractor) continue;

    const rawSpecs = extractor(file.content);
    const seen = new Set<string>();
    const imports: DetectedImport[] = [];

    for (const spec of rawSpecs) {
      if (!spec || ALWAYS_SKIP.test(spec)) continue;
      if (seen.has(spec)) continue;
      seen.add(spec);
      const { isRelative, resolvedPath } = resolveImportSpec(file.path, spec, repoFilePaths);
      imports.push({ spec, isRelative, resolvedPath });
    }

    results.push({ path: file.path, language: file.language, imports, importSpecs: rawSpecs });
  }

  return results;
}

/**
 * Build graph edges: file → file based on resolved relative imports.
 * Nodes are the actual repo files that participate in dependency edges.
 */
export function buildFileDependencyEdges(
  analyses: FileAnalysisResult[]
): Array<{ id: string; source: string; target: string }> {
  const edges: Array<{ id: string; source: string; target: string }> = [];
  const seen = new Set<string>();

  for (const analysis of analyses) {
    for (const imp of analysis.imports) {
      if (imp.resolvedPath && imp.resolvedPath !== analysis.path) {
        const sig = `${analysis.path}->${imp.resolvedPath}`;
        if (!seen.has(sig)) {
          seen.add(sig);
          edges.push({ id: `dep-${sig}`, source: analysis.path, target: imp.resolvedPath });
        }
      }
    }
  }

  return edges;
}
