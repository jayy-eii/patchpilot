# PatchPilot — Real Repository Dependency Mapper

> **See how a code change affects the rest of your application — before you make it.**
> PatchPilot connects to GitHub, reads your actual source code, detects import/dependency
> relationships between files, and renders an interactive dependency graph of your real
> architecture — nothing simulated, nothing mocked.

---

## Table of Contents
1. [What PatchPilot Does](#what-patchpilot-does)
2. [The MVP Flow](#the-mvp-flow)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Dependency Detection](#dependency-detection)
6. [GitHub Rate Limits & Token Handling](#github-rate-limits--token-handling)
7. [Quickstart](#quickstart)
8. [API Reference](#api-reference)
9. [Automated Test Suite](#automated-test-suite)
10. [Project Structure](#project-structure)
11. [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## What PatchPilot Does

Developers rarely know exactly which parts of an application a code change will touch.
Change one file in `services/` and you may silently break three React components, an API
route, and a test — a week later, in production.

**PatchPilot answers the question up front:** pick a GitHub repository, let PatchPilot read
the real source code, and get an interactive map of which files depend on which:

```
User
 ↓
Order.js ──imports──> Payment.js ──imports──> Database.js
```

- **100% real data** — files, edges, and details come from actual `import`/`require`/
  `#include`/`import` statements in your code. No fake graphs, no placeholder nodes.
- **Multi-language** — JavaScript, JSX, TypeScript, TSX, Python, Java, C, and C++.
- **Click-to-inspect** — every node opens a details panel showing what the file imports,
  what it depends on, and who depends on it.

---

## The MVP Flow

```
Connect GitHub        Select Repository         Analyze                 Explore
──────────────        ─────────────────         ─────────               ─────────
username, or          real repo list with       reads source via        interactive
owner/repo, or        name · visibility ·       ONE zip download,       React Flow
repo URL        →     language · updated   →    detects imports    →    graph + click
                                                builds graph            node details
```

| Step | What happens | Data source |
| :--- | :--- | :--- |
| **1. Connect** | Paste a username (`jayy-eii`), a shorthand (`jayy-eii/patchpilot`), or a full URL (`https://github.com/jayy-eii/patchpilot`) | GitHub REST API (repo listing) or direct |
| **2. Select** | Repos list shows real metadata: owner, name, visibility, main language, last-updated time, per-repo **Analyze** button | `GET /users/:user/repos` |
| **3. Analyze** | Live progress: ✓ Reading repository structure → ✓ Detecting source files → ✓ Analyzing imports → ⟳ Building dependency graph. Async run, UI polls every 1.2s | ONE `codeload.github.com` ZIP download |
| **4. Explore** | Files laid out in dependency layers, arrows = `A imports B`, click any node for its **Imports / Dependencies / Used By** | computed locally |

Node details show only what was actually detected:

```
PaymentService.js
Path:        src/services/PaymentService.js
Type:        typescript
Imports:     ../database, stripe
Dependencies: src/db/index.ts        (clickable)
Used By:     src/services/Order.js   (clickable)
```

---

## Technology Stack

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| **Frontend** | React 18 + TypeScript + Vite | Fast HMR dev loop, strict typing |
| **Graph** | `@xyflow/react` (React Flow v12) | Zoom, pan, click, minimap, layered auto-layout |
| **Styling** | Tailwind CSS | Dark developer-tool theme (`#080c14` background, navy surfaces, minimal accents) |
| **Backend** | Node.js + Express + TypeScript | REST API + analysis orchestration |
| **GitHub** | GitHub REST API v3 + `codeload.github.com` | Repo metadata, listing, single-request ZIP snapshot |
| **Testing** | Vitest | 44 automated tests across 7 suites |
| **Deploy** | Single Express process | Serves both the API and the built SPA from one port |

---

## Architecture

```
┌──────────────────────────── Client (React 18 + Vite) ───────────────────────────┐
│  RepositoryExplorer        RepositoryAnalyzer                                   │
│  (connect + repo list)     (progress · React Flow graph · details panel)         │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    │ /api/repos/*
┌───────────────────────────────────▼──────────── Server (Node + Express) ────────┐
│  routes/repos.ts                                                                │
│      ├── status      → live GitHub rate-limit probe (0 API cost)                │
│      ├── GET /       → user's public repos (real GitHub data)                   │
│      ├── POST/analyze→ starts async analysis (returns immediately)              │
│      ├── GET /analysis → poll status + graph + details                          │
│      ├── token       → optional runtime GitHub token (memory only)              │
│  services/github-service.ts                                                     │
│      └── codeload ZIP download → in-memory ZIP extraction (no dependencies)     │
│  engine/dependency-detector.ts                                                  │
│      └── per-language import extraction → relative path resolution → edges      │
│  services/analysis-service.ts                                                   │
│      └── progress steps, file/edge/detail graph construction, stats             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

The legacy simulation engines (`graph-engine`, `risk-scorer`, `recommendation-engine`)
remain intact in the backend for the upcoming challenge features — they are simply not
part of the current UI flow.

---

## Dependency Detection

Pure string parsing — no external parsers, no AST dependencies. Modular registry makes
adding a language a one-line change (`LANGUAGE_EXTRACTORS` in `dependency-detector.ts`).

| Language | Extraction patterns | Resolution strategy |
| :--- | :--- | :--- |
| JS / TS / JSX / TSX | `import x from 'm'`, `import('m')`, `require('m')`, `export ... from 'm'` | relative paths resolved with extension probing (`.ts .tsx .js .jsx .mjs .cjs` + `/index.*`); bare npm packages ignored |
| Python | `from .mod import x`, `import mod.sub` | relative dots resolved (`pkg/payment.py`, `__init__.py`); absolute modules matched against repo paths |
| Java | `import com.foo.bar.Baz;` | class basename matched to `Baz.java` anywhere in the repo |
| C / C++ | `#include "local.h"` | resolved relative to the importing file; system headers (`<...>`) excluded |

Also applied before analysis (never fetched/analyzed): `node_modules`, `dist`, `build`,
`out`, `target`, `vendor`, `coverage`, `.venv`, `__pycache__`, `.git`, minified bundles
(`*.min.js`, `*.bundle.js`), `.d.ts` typings.

The analyzer is intentionally structured so additional language extractors plug in
without touching the GitHub or routing layers.

---

## GitHub Rate Limits & Token Handling

| Path | Cost | Limit |
| :--- | :--- | :--- |
| Repo-listing by username | 1 API call | 60/hr unauthenticated · 5,000/hr with token |
| Full repository analysis | **0 rate-limited calls** | unlimited for practical purposes (codeload CDN) |
| Connection status display | 0 (dedicated `/rate_limit` endpoint) | n/a |

- **Analysis is never blocked by the hourly limit** — it downloads the repo snapshot from
  `codeload.github.com`, which is not subject to REST API rate limits.
- **Token handling (two options):**
  - `.env`: `GITHUB_TOKEN=ghp_...` (loaded via dotenv, used automatically)
  - UI: paste a token into the *Connect* card — kept in **server memory only** for the
    current session, never persisted, never echoed back to the client, never sent to the
    frontend.
- The status line shows the live budget: `API budget: 57/60 · resets in 4m 32s`.

---

## Quickstart

```bash
git clone https://github.com/jayy-eii/patchpilot.git
cd patchpilot
npm install
npm run dev            # client on :5173 (proxied), server on :3001
```

Open `http://localhost:5173`, paste a username or repo URL, click **Analyze**.

Production single-service mode:

```bash
npm run build
npm start              # Express serves API + built SPA on :3001
```

Environment (see `.env.example`):

```bash
PORT=3001
NODE_ENV=development
# Optional — raises GitHub REST limit from 60/hr to 5,000/hr (server-side only)
# GITHUB_TOKEN=ghp_your_token_here
```

Try it on this repository itself: paste `jayy-eii/patchpilot` — the graph shows the
real client/server dependency map, e.g.
`App.tsx → RepositoryAnalyzer.tsx → api/client.ts`, `server.ts → routes/repos.ts →
services/analysis-service.ts → engine/dependency-detector.ts`.

---

## API Reference

Base URL: `/api`

```
GET    /repos/status          GitHub connectivity + live rate-limit budget/reset
GET    /repos?username=usr    List a user's public repos (real GitHub data)
POST   /repos/analyze         { owner, repo } → start async analysis (immediate 200)
GET    /repos/analysis        Poll: status · progress · files · edges · details · stats
POST   /repos/token           { token | null } — runtime token (memory only)
GET    /repos/token           { tokenPresent } — never returns the token itself
DELETE /repos/analysis        Clear current analysis
GET    /health                Basic health probe
```

Legacy simulation endpoints (`/services`, `/simulations`, `/analysis/spof-ranking`,
`/incidents`, `/scenarios`, `/tests`, `/topology/*`) still exist for the upcoming
challenge phases.

Error handling: users never see stack traces — GitHub 404s become
`Repository '<owner>/<repo>' not found or is private.`, 403s become a friendly
rate-limit message with the reset guidance, and analysis failures become
`Repository analysis failed. Please try again.`

---

## Automated Test Suite (44 Vitest Tests)

```bash
npm test
```

| Suite | Tests | Covers |
| :--- | :-- | :--- |
| `repo-analysis.test.ts` | 9 | real ZIP extraction (STORE + DEFLATE), language filtering, TS/JS/Python/Java import resolution, dependency edges |
| `graph-engine.test.ts` | 7 | BFS traversal, cycles, isolated nodes, fan-out |
| `risk-scorer.test.ts` | 4 | severity tiers + formula breakdown |
| `recommendation-engine.test.ts` | 4 | resilience patterns |
| `topology-import.test.ts` | 8 | topology validation rules |
| `smarter-analysis.test.ts` | 6 | SPOF ranking, multi-failure, chains |
| `api.test.ts` | 6 | legacy endpoint behavior |

---

## Project Structure

```
patchpilot/
├── client/
│   └── src/
│       ├── App.tsx                      # two-view flow state (repos ↔ analysis)
│       ├── api/client.ts                # typed fetch wrapper for /api
│       ├── components/
│       │   ├── Navbar.tsx               # flow indicator: Repository → Graph
│       │   ├── RepositoryExplorer.tsx   # connect + real repo list + token field
│       │   └── RepositoryAnalyzer.tsx   # progress · React Flow · details panel
│       └── types/analysis.ts            # shared analysis types
├── server/
│   ├── src/
│   │   ├── server.ts                    # Express + dotenv + unified SPA serving
│   │   ├── routes/repos.ts              # new GitHub/analysis REST endpoints
│   │   ├── services/
│   │   │   ├── github-service.ts        # REST API + codeload ZIP + in-memory unzip
│   │   │   ├── analysis-service.ts      # async orchestrator with progress tracking
│   │   │   └── simulation-service.ts    # legacy engine (future challenge phases)
│   │   └── engine/
│   │       └── dependency-detector.ts   # multi-language import extraction + resolution
│   └── tests/                           # 7 suites, 44 tests
├── .env.example
└── README.md
```

---

## Known Limitations & Roadmap

### Current MVP limitations

- Repo listing supports **public repositories only** (a token is needed to see private ones).
- One analysis in flight at a time; state lives in server memory for the current session.
- Very large repositories (>3000 supported source files) are rejected with a clear error.
- Import resolution is heuristic: highly dynamic imports (computed paths, aliases like
  `@/components`, mono-repo workspace packages) may not resolve.

### Next up (challenge phases — architecture is ready for them)

- Fault simulations (invalid data, timeouts, full service failure) layered on the real graph
- Automated test execution with passed/failed/blocked tracking
- Repair suggestions + AI-assisted fixes with verification
- OpenTelemetry ingestion to merge *runtime* dependency truth with the static analysis
- Visual graph editing / drag-drop architecture builder

---

> PatchPilot MVP — GitHub → Analysis → Dependency Graph, working on real data.
