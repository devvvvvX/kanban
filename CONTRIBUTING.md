# Contributing to Kanban

Thank you for your interest in contributing to **Kanban**! We are building a premium, native-feeling macOS personal engineering & project management desktop application — pairing 100% offline-first privacy, relational ticket tracking, sub-100ms visual querying, and Model Context Protocol (MCP) AI agent co-working without cloud lock-in.

Whether you are fixing a bug, adding a new workflow feature, optimizing query latency, or polishing the macOS desktop UI, we welcome your contributions.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Our Core Principles](#our-core-principles)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Setting Up the Environment](#setting-up-the-environment)
  - [Running in Development Mode](#running-in-development-mode)
  - [Building Release Bundles & DMGs](#building-release-bundles--dmgs)
- [Project Architecture](#project-architecture)
  - [Directory Structure](#directory-structure)
  - [Frontend Architecture (React 19, TypeScript & Vite)](#frontend-architecture-react-19-typescript--vite)
  - [Desktop Shell (Tauri 2 & Rust)](#desktop-shell-tauri-2--rust)
  - [Database & Storage (SQLite WAL Mode)](#database--storage-sqlite-wal-mode)
  - [Model Context Protocol (MCP) Stdio Server](#model-context-protocol-mcp-stdio-server)
- [Critical UI & Design Invariants](#critical-ui--design-invariants)
  - [The 12px Typography Floor Rule](#the-12px-typography-floor-rule)
  - [macOS Titlebar & Header De-cluttering](#macos-titlebar--header-de-cluttering)
  - [Eye-Comfort Canvas Gradients & Automatic Appearance Balancing](#eye-comfort-canvas-gradients--automatic-appearance-balancing)
  - [Webview Tabs & DOM Persistence](#webview-tabs--dom-persistence)
  - [Ticket Drawer Markdown Rendering](#ticket-drawer-markdown-rendering)
- [Development Workflow](#development-workflow)
  - [1. Branching Strategy](#1-branching-strategy)
  - [2. Code Formatting & Typechecking](#2-code-formatting--typechecking)
  - [3. Running Tests](#3-running-tests)
  - [4. Commit Message Conventions](#4-commit-message-conventions)
  - [5. Submitting a Pull Request](#5-submitting-a-pull-request)
- [Issue Reporting & Feature Requests](#issue-reporting--feature-requests)
- [License](#license)

---

## Code of Conduct

Kanban is committed to providing a welcoming, inclusive, and harassment-free environment for everyone. All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

Please review the full [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for detailed community standards, reporting procedures, and enforcement guidelines.

---

## Our Core Principles

Before writing code for Kanban, please keep these non-negotiable architectural tenets in mind:

1. **100% Offline-First & Zero-Cloud Privacy**: No remote analytics, no telemetry, no mandatory cloud sync, and no third-party network pings. All user data resides strictly on the user's local machine in SQLite.
2. **Sub-100ms Performance**: Instant response across visual querying, Kanban board card moves, full-text filtering, and tab switching. Deterministic sorting and indexed lookups ensure performance scales gracefully even with thousands of tickets.
3. **Native macOS Polish**: Follow Apple Human Interface Guidelines (HIG) closely. We favor native titlebar overlays, SF Pro typography, keyboard-first navigation (`Cmd+K`, `Cmd+N`, `Cmd+\`, `Esc`), and fluid 60fps micro-animations.
4. **Data Sovereignty & Account Isolation**: Multiple accounts on a single machine operate with strict cryptographic separation (Argon2id hashing, 256-bit recovery keys, zero cross-account data leakage).
5. **Agent Co-Working via MCP**: Support standard Model Context Protocol (MCP) stdio communication so external AI coding assistants (Claude Desktop, Cursor, Antigravity) can read, create, update, and search tickets directly with real-time UI reflection.

---

## Development Setup

### Prerequisites

- **Operating System**: macOS 13.0 (Ventura) or newer (Apple Silicon M-Series or Intel x86_64).
- **Node.js**: v20.x or newer (v22 LTS recommended).
- **Package Manager**: `npm` (bundled with Node.js).
- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```
- **Rust Toolchain** (required for compiling native desktop bundles):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  rustup update stable
  ```
- **Tauri CLI v2**:
  ```bash
  npm install -g @tauri-apps/cli
  ```

### Setting Up the Environment

1. Fork the repository on GitHub: [devvvvvX/kanban](https://github.com/devvvvvX/kanban).
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/kanban.git
   cd kanban
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development Mode

You can run Kanban in two ways:

#### 1. Web Browser UI Mode (Rapid Prototyping)
Runs Vite dev server with fast hot module replacement (HMR) in Chrome, Safari, or Arc:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 2. Native macOS Desktop Mode (Tauri)
Runs Vite frontend embedded inside the native macOS Cocoa window with full desktop IPC capabilities:
```bash
npm run tauri dev
```

### Building Release Bundles & DMGs

#### Compile Frontend & Standalone MCP Server
```bash
npm run build
```
This runs TypeScript typechecking, builds the Vite production bundle to `dist/`, and bundles the standalone MCP stdio server to `dist/mcp/cli.js`.

#### Hot-Deploy In-Place to `/Applications/Kanban.app`
To update your local installed application without losing SQLite data or preferences:
```bash
./scripts/update-local-app.sh
```

#### Package a Standalone Release DMG
```bash
npm run build:dmg
```
Outputs the packaged release DMG to `./release/` with SHA-256 checksums.

---

## Project Architecture

### Directory Structure

```text
kanban/
├── assets/                 # Brand assets and icon source files
├── docs/                   # System documentation, design specifications & screenshots
│   ├── ARCHITECTURE.md     # Relational schema, SQLite WAL, and query compiler architecture
│   ├── DESIGN_SYSTEM.md    # Design tokens, color scales, and typography invariants
│   ├── MCP_GUIDE.md        # Guide for connecting Claude Desktop, Cursor, and MCP clients
│   └── screenshots/        # High-resolution application screenshots
├── e2e/                    # Playwright end-to-end integration test suites
├── public/                 # Static web assets & sql-wasm.wasm WebAssembly binary
├── scripts/                # Packaging, DMG generation & app management scripts
│   ├── build-dmg.sh        # Automates production DMG packaging
│   ├── kanban-mcp          # Executable wrapper script for MCP stdio launcher
│   └── update-local-app.sh # In-place updater for /Applications/Kanban.app
├── src/                    # Frontend source code (React 19 + TypeScript)
│   ├── components/         # Modular UI components (board, tickets, modals, sidebar, search)
│   ├── context/            # React Context providers (Auth, Board, Ticket, Tab, Focus)
│   ├── hooks/              # Custom React hooks (useEscapeKey, useVirtualizer, etc.)
│   ├── lib/                # Core business logic and database abstractions
│   │   ├── auth/           # Argon2id hashing, rate limiting, and recovery phrase logic
│   │   ├── backup/         # Portable JSON backups with SHA-256 integrity verification
│   │   ├── db/             # SQLite connection pool, schema migrations & WASM bindings
│   │   ├── mcp/            # Model Context Protocol stdio server & domain tools
│   │   ├── query/          # Sub-100ms parameterized visual query compiler
│   │   ├── tickets/        # Ticket CRUD, subtasks, dependencies, and activity logs
│   │   └── todos/          # Daily/weekly cadence todos and local reminder scheduler
│   ├── styles/             # Vanilla CSS design system (theme.css tokens)
│   ├── types/              # Strict TypeScript domain interfaces
│   └── utils/              # Helper utilities (notifications, sound effects, link handlers)
├── src-tauri/              # Rust Native Backend (Tauri 2.x)
│   ├── src/                # Tauri IPC endpoints (native notifications, window focus, Finder)
│   ├── Cargo.toml          # Rust dependencies & bundle configuration
│   └── tauri.conf.json     # Window dimensions, traffic light offsets & app bundle metadata
└── tests/                  # Vitest unit, integration & benchmark test suites
```

### Frontend Architecture (React 19, TypeScript & Vite)

- **Pure TypeScript & Strict Typing**: All domain entities (`Ticket`, `Project`, `Epic`, `Subtask`, `Account`) are strictly defined in `src/types/`.
- **Zero Heavy Component Frameworks**: We do not use bloated styling frameworks. Clean, maintainable Vanilla CSS tokens in `src/styles/theme.css` ensure 60fps rendering without CSS-in-JS runtime overhead.
- **State Management**: Scoped React Context providers (`AuthContext`, `ProjectContext`, `TicketContext`, `TabContext`, `FocusContext`) prevent cross-tree re-render thrashing.

### Desktop Shell (Tauri 2 & Rust)

- **Minimal Footprint**: Uses the native macOS WebKit engine via Tauri 2, consuming less than 60MB of base RAM.
- **Native Window Overlay**: Configured with `titleBarStyle: "Overlay"` and custom traffic light inset `{ x: 16, y: 22 }` for an authentic macOS look and feel.
- **Native macOS Audio & Alerts**: Native AppleScript notification dispatch (`osascript`) with Critical User Attention window bouncing and Web Audio API tone synthesis.

### Database & Storage (SQLite WAL Mode)

- **Dual-Engine SQLite**:
  - **Node.js / Desktop**: Uses `better-sqlite3` and `rusqlite` for high-throughput disk operations in Write-Ahead Logging (WAL) mode.
  - **Browser / Web**: Uses `sql.js` WebAssembly (`sql-wasm.wasm`) with binary IndexedDB persistence.
- **Strict Referential Integrity**: Foreign keys enabled (`PRAGMA foreign_keys = ON`), indexed multi-column lookups, and transaction safety.

### Model Context Protocol (MCP) Stdio Server

- Conforms strictly to the official Model Context Protocol (MCP) specification.
- Exposes 8 domain tools (`list_tickets`, `get_ticket`, `create_ticket`, `update_ticket`, `delete_ticket`, `search_tickets`, `list_projects`, `get_project_summary`, plus note and todo management).
- Enforces token-based local authentication and account context scoping.

---

## Critical UI & Design Invariants

These invariants are strictly enforced across the codebase and validated by automated tests:

### The 12px Typography Floor Rule
- **NEVER use font sizes smaller than 12px** (`var(--text-xs)` / `12px`).
- Sub-12px micro-fonts (`10px` or `11px`) are strictly forbidden across both `theme.css` and inline React styles.
- Validated by `tests/ui/designTokensAndPrimitives.test.ts`.

### macOS Titlebar & Header De-cluttering
The top macOS window header (`AppShell.tsx`) must remain pristine, uncluttered, and native:
1. **Brand**: Display `Kanban` only. Do NOT display a version badge (`v1.0`) in the header (version belongs in Settings / About).
2. **Refresh Button**: Icon-only button (`<RotateCw size={13} />`), no text label.
3. **Search Button**: Retain `Cmd+K` global search button.
4. **Focus Timer**: Renders a live real-time countdown pill (`HeaderFocusTimer.tsx`) when active or a subtle Focus launcher when idle.
5. **No Header Clutter**: MCP Active button, Sun/Moon button, and Settings gear button are removed from the header and consolidated in the Preferences modal.
6. **Account Switcher**: Renders display name and chevron pill; does NOT render a circular initials avatar block.

### Eye-Comfort Canvas Gradients & Automatic Appearance Balancing
- Custom eye-comfort tints for fatigue-free engineering:
  - **Light & Fresh**: `warm-sand`, `soft-slate`, `light-blue`, `light-green`, `magenta`, `aurora-mist`, `lavender-dusk`, `sunset-glow`.
  - **Dark & Nocturnes**: `dark-obsidian`, `navy-blue`, `dark-emerald`, `dark-magenta`, `deep-indigo`.
- **Automatic Appearance Balancing**: Selecting any light tint automatically sets `data-theme="light"` and high-contrast dark text/borders. Selecting any dark nocturne automatically sets `data-theme="dark"` and crisp luminous text/borders.

### Webview Tabs & DOM Persistence
- In `AppShell.tsx`, open `<WebviewTab>` instances are kept mounted in the DOM across tab switches using `display: isTabActive ? "flex" : "none"`.
- They are **never unmounted** when switching between board, todos, notes, or tickets, ensuring media streams, form states, and scroll positions persist seamlessly.

### Ticket Drawer Markdown Rendering
- Whenever any ticket drawer (`TicketDetailDrawer.tsx`) opens, the description **MUST render in Markdown format by default** (`isPreviewDesc: true`).
- Double-clicking or selecting "Edit" switches to the markdown editor.

---

## Development Workflow

### 1. Branching Strategy

- Always create your feature or bug fix branch from `main`:
  ```bash
  git checkout -b feature/your-feature-name
  # or
  git checkout -b fix/issue-description
  ```
- Keep branches focused and scoped to a single purpose.

### 2. Code Formatting & Typechecking

Before committing, ensure your code compiles with zero TypeScript errors:

```bash
# Run TypeScript compiler checks
npm run typecheck
```

### 3. Running Tests

Kanban maintains an extensive test suite covering authentication crypto, relational ticket operations, visual query compilation, MCP stdio communication, and UI design token assertions:

```bash
# Run all Vitest unit and integration test suites
npm test

# Run tests in watch mode during development
npm run test:watch

# Run a specific test suite
npx vitest run tests/query/queryEngine.test.ts
npx vitest run tests/mcp/server.test.ts
npx vitest run tests/ui/designTokensAndPrimitives.test.ts
```

### 4. Commit Message Conventions

We use Conventional Commits format:

```text
feat(board): add WIP limit visual indicator on column hover
fix(mcp): resolve auth token validation for local agent requests
perf(query): index project_id and status for sub-50ms query latency
docs(readme): add Cursor MCP connection configuration example
test(ui): add 12px font floor validation test for modal badges
```

### 5. Submitting a Pull Request

1. Ensure all 39+ Vitest test suites pass (`npm test`).
2. Ensure TypeScript compiles without errors (`npm run typecheck`).
3. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against `devvvvvX/kanban:main`.
5. Complete the PR template checklist.

---

## Issue Reporting & Feature Requests

- **Bug Reports**: Please open an issue using the [Bug Report Template](https://github.com/devvvvvX/kanban/issues/new?template=bug_report.yml). Include your macOS version, Node.js version, reproduction steps, and console logs.
- **Feature Requests**: Please open an issue using the [Feature Request Template](https://github.com/devvvvvX/kanban/issues/new?template=feature_request.yml) describing the user story, proposed solution, and alternatives considered.

---

## License

Kanban is open-source software licensed under the [MIT License](LICENSE).

