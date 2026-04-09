import chokidar, { type FSWatcher } from 'chokidar';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createPathFilter, type PathFilter } from '../projectFilter.js';
import { isSupportedFile } from '../supportedFormats.js';
import type { ConfigRef, WsMessage } from '../types/index.js';

// `ignore` is a CJS module; use createRequire so NodeNext resolution doesn't
// mis-type the default export as non-callable.
const _req = createRequire(import.meta.url);
type Ignore = { add(p: string): Ignore; ignores(p: string): boolean };
const ignoreFactory = _req('ignore') as () => Ignore;

const IGNORED_DIRS = [
  /(^|[/\\])\../, // dotfiles / dotdirs (includes .git)
  /node_modules/,
  /[/\\](dist|build|\.next|target|\.venv)[/\\]/,
  /[/\\](dist|build|\.next|target|\.venv)$/,
];

/** Returns true if `p` matches any of the hardcoded ignore patterns. */
function matchesHardcodedIgnore(p: string): boolean {
  return IGNORED_DIRS.some((r) => r.test(p));
}

interface ScanResult {
  tooLarge: boolean;
  dirCount: number;
  /** Returns true if the relative path should be gitignored. */
  isGitignored: (relPath: string, isDir: boolean) => boolean;
  /** Relative paths of nested git repos (subdirs that contain .git). */
  nestedRepoDirs: string[];
}

/**
 * Synchronous BFS pre-scan of `projectRoot`.
 *
 * - Skips dirs matching IGNORED_DIRS patterns.
 * - Detects nested git repos (subdirs containing .git) and excludes them.
 * - Reads .gitignore files at every level and accumulates ignore rules.
 * - Counts watchable directories; stops and sets tooLarge=true if maxDirs exceeded.
 */
export function scanProject(projectRoot: string, maxDirs: number): ScanResult {
  const rules: Array<{ relDir: string; ig: Ignore }> = [];
  const nestedRepoDirs: string[] = [];
  let dirCount = 0;
  let tooLarge = false;

  // Queue entries: [absolutePath, relativePath]
  const queue: Array<[string, string]> = [[projectRoot, '']];

  while (queue.length > 0) {
    const [absDir, relDir] = queue.shift()!;
    dirCount++;

    if (dirCount > maxDirs) {
      tooLarge = true;
      break;
    }

    // Load .gitignore at this level
    const gitignorePath = path.join(absDir, '.gitignore');
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      rules.push({ relDir, ig: ignoreFactory().add(content) });
    } catch {
      // no .gitignore — fine
    }

    // Enumerate subdirectories
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const childAbs = path.join(absDir, entry.name);

      // Skip hardcoded ignores (dotfiles, node_modules, dist, etc.)
      if (matchesHardcodedIgnore(childRel)) continue;

      // Detect nested git repos: a non-root subdirectory that contains .git
      try {
        fs.statSync(path.join(childAbs, '.git'));
        // .git exists → nested repo; exclude and don't descend
        nestedRepoDirs.push(childRel);
        continue;
      } catch {
        // no .git → not a nested repo
      }

      queue.push([childAbs, childRel]);
    }
  }

  const isGitignored = (relPath: string, isDir: boolean): boolean => {
    for (const { relDir, ig } of rules) {
      let rel: string;
      if (relDir === '') {
        rel = relPath;
      } else {
        if (!relPath.startsWith(relDir + '/')) continue;
        rel = relPath.slice(relDir.length + 1);
      }
      if (!rel) continue;
      // The ignore package wants a trailing slash for directories
      if (ig.ignores(rel) || (isDir && ig.ignores(rel + '/'))) return true;
    }
    return false;
  };

  return { tooLarge, dirCount, isGitignored, nestedRepoDirs };
}

/**
 * Returns true if the path should be ignored by the watcher.
 * For file entries (not directories), also rejects files with
 * unsupported extensions or paths rejected by the project filter.
 * For directories, honours the filter's `acceptsDir` so whole
 * excluded subtrees are never descended into.
 */
function makeIgnored(
  ignoredDirs: (RegExp | ((f: string, stats?: fs.Stats) => boolean))[],
  projectRoot: string,
  filter: PathFilter,
  scan: ScanResult,
) {
  const nestedRepoSet = new Set(
    scan.nestedRepoDirs.map((r) => path.join(projectRoot, r)),
  );

  return [
    ...ignoredDirs,
    (filePath: string, stats?: fs.Stats) => {
      // Nested git repo directories
      if (nestedRepoSet.has(filePath)) return true;

      const rel = path.relative(projectRoot, filePath);
      // Never ignore the project root itself — chokidar must be able to
      // enter it. Anything outside the root is also left alone.
      if (!rel || rel.startsWith('..')) return false;

      const isDir = !stats || stats.isDirectory();

      // Gitignore rules
      if (scan.isGitignored(rel, isDir)) return true;

      if (filter.isIdentity) {
        if (isDir) return false;
        return !isSupportedFile(filePath);
      }

      if (isDir) return !filter.acceptsDir(rel);
      if (!isSupportedFile(filePath)) return true;
      return !filter.acceptsFile(rel);
    },
  ];
}

export class WatcherManager {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeProjectId: string | null = null;
  /** Resolves when the previous watcher has fully closed its fds. */
  private closePromise: Promise<void> = Promise.resolve();
  /** True while a watcher close() is in flight. */
  private closing = false;
  /**
   * Incremented on every activate() and deactivate() call.
   * Any pending closePromise.then() callback checks this before starting a
   * new watcher — prevents duplicate watchers on rapid project switching.
   */
  private activationEpoch = 0;

  constructor(private configRef: ConfigRef) {}

  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  activate(projectId: string, onEvent: (msg: WsMessage) => void): void {
    // Synchronously tear down current watcher (nulls ref, starts async close)
    this.deactivate();

    const project = this.configRef.current.projects.find((p) => p.id === projectId);
    if (!project) {
      console.warn(`[notebook] watcher: unknown project id "${projectId}"`);
      return;
    }

    this.activeProjectId = projectId;
    const filter = createPathFilter(project.include, project.exclude);

    // Stamp this activation so any concurrent or superseded attempt is a no-op.
    const epoch = ++this.activationEpoch;

    const start = () => {
      if (this.activationEpoch !== epoch) return;
      this.startWatcher(project.path, projectId, onEvent, filter);
    };

    if (this.closing) {
      // Previous watcher is still releasing fds — defer until fully closed.
      this.closePromise.then(start);
    } else {
      // No close in flight; start immediately (synchronous, no microtask delay).
      start();
    }
  }

  private startWatcher(
    projectRoot: string,
    projectId: string,
    onEvent: (msg: WsMessage) => void,
    filter: PathFilter,
    forcePolling = false,
  ): void {
    const MAX_DIRS = this.configRef.current.watcher.maxWatchedDirs ?? 2000;
    const scan = scanProject(projectRoot, MAX_DIRS);

    if (scan.tooLarge) {
      const msg =
        `Project "${projectId}" has too many directories (>${MAX_DIRS}). ` +
        `Watcher disabled — narrow the watched path or add excludes.`;
      console.warn(`[notebook] watcher: ${msg}`);
      onEvent({ type: 'watcher-warning', projectId, message: msg });
      return;
    }

    const usePolling = forcePolling || this.configRef.current.watcher.usePolling;

    this.watcher = chokidar.watch(projectRoot, {
      ignored: makeIgnored(IGNORED_DIRS, projectRoot, filter, scan),
      persistent: true,
      ignoreInitial: true,
      usePolling,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        // Increased from 50ms: reduces concurrent open fds on large trees
        pollInterval: 200,
      },
    });

    const handle = (event: 'change' | 'add' | 'unlink', filePath: string) => {
      const rel = path.relative(projectRoot, filePath);
      const existing = this.debounceTimers.get(filePath);
      if (existing) clearTimeout(existing);

      this.debounceTimers.set(
        filePath,
        setTimeout(() => {
          this.debounceTimers.delete(filePath);
          onEvent({ type: 'reload', path: rel, event });
        }, 75),
      );
    };

    this.watcher
      .on('change', (p) => handle('change', p))
      .on('add', (p) => handle('add', p))
      .on('unlink', (p) => handle('unlink', p))
      .on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOSPC') {
          console.error(
            '[notebook] watcher error: inotify limit exhausted (ENOSPC).\n' +
              'Fix: echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p\n' +
              'Falling back to polling.',
          );
          // Restart with polling
          this.deactivate();
          this.startWatcher(projectRoot, projectId, onEvent, filter, true);
        } else if (err.code === 'EMFILE') {
          // Too many open files — polling on a large tree would be worse.
          // Mark the project unwatchable and surface a clear error.
          const msg =
            `EMFILE: too many open files — watcher disabled for project "${projectId}". ` +
            `Try reducing the project scope or increasing the OS fd limit (ulimit -n).`;
          console.error(`[notebook] watcher: ${msg}`);
          this.deactivate();
          onEvent({ type: 'watcher-warning', projectId, message: msg });
        } else {
          console.error('[notebook] watcher error:', err);
        }
      });
  }

  deactivate(): void {
    // Invalidate any pending activation callback
    this.activationEpoch++;

    // Cancel any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      // Track the close promise so activate() can await it before starting a
      // new watcher — prevents fd leaks on rapid project switching.
      this.closing = true;
      this.closePromise = this.watcher.close().catch(() => {}).finally(() => {
        this.closing = false;
      });
      this.watcher = null;
    }
    this.activeProjectId = null;
  }

  destroy(): void {
    this.deactivate();
  }
}
