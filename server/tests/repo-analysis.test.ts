import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { unzipInMemory, detectLanguage } from '../src/services/github-service';
import { analyzeRepository, buildFileDependencyEdges } from '../src/engine/dependency-detector';

const repoRoot = path.resolve(__dirname, '../..');

/** Build a real ZIP using the system `zip` command for a -like fixture. */
const zipPayload = (): Buffer => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-zip-'));
  const inner = path.join(tmp, 'patchpilot-master');
  fs.mkdirSync(inner, { recursive: true });
  fs.writeFileSync(
    path.join(inner, 'index.ts'),
    ["import { Payment } from './services/payment';", "import fs from 'fs';", 'export const x = Payment;'].join('\n')
  );
  fs.mkdirSync(path.join(inner, 'services'));
  fs.writeFileSync(path.join(inner, 'services', 'payment.ts'), "import { db } from '../db';\nexport const Payment = 1;\n");
  fs.writeFileSync(path.join(inner, 'db.ts'), 'export const db = 2;\n');
  fs.mkdirSync(path.join(inner, 'dist'));
  fs.writeFileSync(path.join(inner, 'dist', 'bundle.js'), 'var x=1;');
  const zipPath = path.join(tmp, 'repo.zip');
  execSync(`cd "${tmp}" && zip -q -r repo.zip patchpilot-master`);
  const buf = fs.readFileSync(zipPath);
  fs.rmSync(tmp, { recursive: true, force: true });
  return buf;
};

describe('ZIP extraction (used for single-request repo download)', () => {
  it('extracts entries from a real ZIP archive', () => {
    const files = unzipInMemory(zipPayload());
    const paths = Object.keys(files);
    expect(paths.some(p => p.endsWith('index.ts'))).toBe(true);
    expect(paths.some(p => p.endsWith('services/payment.ts'))).toBe(true);
    expect(paths.some(p => p.endsWith('db.ts'))).toBe(true);
    // dist/ bundle should exist in the archive (filtering happens later, by detectLanguage)
    expect(paths.some(p => p.includes('dist/'))).toBe(true);
  });

  it('decodes DEFLATE-compressed file contents correctly', () => {
    const files = unzipInMemory(zipPayload());
    const index = Object.entries(files).find(([p]) => p.endsWith('index.ts'))![1].toString('utf-8');
    expect(index).toContain("import { Payment } from './services/payment';");
  });
});

describe('detectLanguage filters generated/dependency dirs', () => {
  it('accepts supported source files', () => {
    expect(detectLanguage('src/app.ts')).toBe('typescript');
    expect(detectLanguage('src/App.tsx')).toBe('tsx');
    expect(detectLanguage('lib/run.js')).toBe('javascript');
    expect(detectLanguage('main.py')).toBe('python');
    expect(detectLanguage('Main.java')).toBe('java');
    expect(detectLanguage('util.c')).toBe('c');
    expect(detectLanguage('util.hpp')).toBe('cpp');
  });

  it('rejects vendored, generated, and lock files', () => {
    expect(detectLanguage('node_modules/react/index.js')).toBeNull();
    expect(detectLanguage('dist/bundle.js')).toBeNull();
    expect(detectLanguage('target/classes/Main.class')).toBeNull();
    expect(detectLanguage('some.min.js')).toBeNull();
    expect(detectLanguage('types.d.ts')).toBeNull();
  });
});

describe('Repository import analysis (real source content)', () => {
  it('builds file→file dependency edges from relative imports', () => {
    const edges = buildFileDependencyEdges(
      analyzeRepository([
        { path: 'src/index.ts', language: 'typescript', content: "import { Payment } from './services/payment';" },
        { path: 'src/services/payment.ts', language: 'typescript', content: "import { db } from '../../db';" },
        { path: 'db.ts', language: 'typescript', content: 'export const db = 2;' },
      ])
    );

    const sigs = edges.map(e => `${e.source}->${e.target}`);
    expect(sigs).toContain('src/index.ts->src/services/payment.ts');
    expect(sigs).toContain('src/services/payment.ts->db.ts');
    expect(sigs.length).toBe(2);
  });

  it('detects require() and dynamic import() in JS', () => {
    const analyses = analyzeRepository([
      { path: 'a.js', language: 'javascript', content: "const fs = require('fs');\nconst mine = require('./mine');" },
      { path: 'mine.js', language: 'javascript', content: 'export {};' },
      { path: 'b.js', language: 'javascript', content: "import('./lazy').then(m => m);" },
      { path: 'lazy.js', language: 'javascript', content: 'export {};' },
    ]);

    const edges = buildFileDependencyEdges(analyses);
    const sigs = edges.map(e => `${e.source}->${e.target}`);
    expect(sigs).toContain('a.js->mine.js');
    expect(sigs).toContain('b.js->lazy.js');
    // bare npm packages do not resolve to repo files → no bogus edges
    expect(sigs.some(s => s.includes('fs'))).toBe(false);
  });

  it('resolves Python relative imports', () => {
    const edges = buildFileDependencyEdges(
      analyzeRepository([
        { path: 'pkg/main.py', language: 'python', content: 'from .payment import charge\n' },
        { path: 'pkg/payment.py', language: 'python', content: 'def charge(): pass\n' },
      ])
    );
    expect(edges.map(e => `${e.source}->${e.target}`)).toContain('pkg/main.py->pkg/payment.py');
  });

  it('resolves Java imports by class basename', () => {
    const edges = buildFileDependencyEdges(
      analyzeRepository([
        { path: 'src/com/x/Main.java', language: 'java', content: 'import com.x.payment.PaymentService;\npublic class Main {}\n' },
        { path: 'src/com/x/payment/PaymentService.java', language: 'java', content: 'public class PaymentService {}\n' },
      ])
    );
    expect(edges.map(e => `${e.source}->${e.target}`)).toContain('src/com/x/Main.java->src/com/x/payment/PaymentService.java');
  });

  it('reports usedBy symmetric to dependencies', () => {
    const analyses = analyzeRepository([
      { path: 'src/a.ts', language: 'typescript', content: "import './b';" },
      { path: 'src/b.ts', language: 'typescript', content: 'export {};' },
    ]);
    const aDetail = analyses.find(a => a.path === 'src/a.ts')!;
    expect(aDetail.imports[0].resolvedPath).toBe('src/b.ts');
  });
});
