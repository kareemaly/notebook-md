# Contributing to notebook-md

Thanks for your interest! This is a small OSS project, so contributions are
welcome and the process is intentionally lightweight.

## Getting started

```sh
git clone https://github.com/kareemaly/notebook-md.git
cd notebook-md
npm install
npm run dev
```

`npm run dev` boots the backend (`tsx watch`) and the Vite frontend
concurrently. The viewer is served at <http://localhost:9001>.

If you don't have a `notebook.config.json` yet, copy the example:

```sh
cp notebook.config.json.example notebook.config.json
```

…and point a project at a folder of markdown notes you have lying around.

## Project layout

```
src/                 # Backend (Node + Express + ws + chokidar)
  cli/               # commander-based CLI entry points
  config/            # config loading + hot-reload
  server/            # HTTP routes + WebSocket
  search/            # ripgrep with pure-JS fallback
  types/             # shared backend types
frontend/src/        # Frontend (Vite + React + shadcn/ui)
  components/        # UI components
  hooks/             # data hooks (useFile, useFileTree, useWebSocket, …)
  types.ts           # frontend-only types
tests/               # Vitest backend tests
```

The backend and frontend are independent TypeScript projects with their own
`tsconfig.json`. The top-level `npm run typecheck` checks both.

## Before opening a PR

Please make sure all of these pass locally — CI runs the same on Node 18, 20,
and 22:

```sh
npm run lint
npm run typecheck
npm run test:run
npm run build
```

If you change backend behavior, add or update a test in `tests/`. Frontend
test setup is not in place yet — it's fine to ship UI changes without one.

## Branch & commit conventions

- Branch off `main`. Short, descriptive branch names (`fix/config-reload`,
  `feat/sidebar-resize`).
- Commit messages follow a loose conventional-commit style:
  `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`. Keep the subject
  under ~70 characters; put detail in the body if needed.
- Small, focused commits over giant ones. Squash on merge is fine.

## Reporting bugs & proposing features

- **Bugs**: open an issue using the
  [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Steps to
  reproduce + expected vs. actual is the most helpful thing you can give.
- **Features**: open an issue using the
  [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).
  Describe the problem first, then the proposal — small PRs that match an
  agreed-upon proposal are much more likely to land.

Thanks for helping make notebook-md better!
