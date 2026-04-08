import chokidar, { type FSWatcher } from 'chokidar';
import fs from 'node:fs';
import path from 'node:path';
import { createPathFilter, type PathFilter } from '../projectFilter.js';
import { isSupportedFile } from '../supportedFormats.js';
import type { ConfigRef, WsMessage } from '../types/index.js';

const IGNORED_DIRS = [
  /(^|[/\\])\../, // dotfiles / dotdirs
  /node_modules/,
  /[/\\](dist|build|\.next|target|\.venv)[/\\]/,
  /[/\\](dist|build|\.next|target|\.venv)$/,
];

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
) {
  return [
    ...ignoredDirs,
    (filePath: string, stats?: fs.Stats) => {
      if (filter.isIdentity) {
        if (!stats || stats.isDirectory()) return false;
        return !isSupportedFile(filePath);
      }
      const rel = path.relative(projectRoot, filePath);
      // Never ignore the project root itself — chokidar must be able to
      // enter it. Anything outside the root is also left alone; chokidar
      // won't actually descend there but belt-and-suspenders.
      if (!rel || rel === '' || rel.startsWith('..')) return false;
      if (!stats || stats.isDirectory()) {
        return !filter.acceptsDir(rel);
      }
      if (!isSupportedFile(filePath)) return true;
      return !filter.acceptsFile(rel);
    },
  ];
}

export class WatcherManager {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeProjectId: string | null = null;

  constructor(private configRef: ConfigRef) {}

  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  activate(projectId: string, onEvent: (msg: WsMessage) => void): void {
    // Tear down existing watcher before switching projects
    this.deactivate();

    const project = this.configRef.current.projects.find((p) => p.id === projectId);
    if (!project) {
      console.warn(`[notebook] watcher: unknown project id "${projectId}"`);
      return;
    }

    this.activeProjectId = projectId;
    const filter = createPathFilter(project.include, project.exclude);
    this.startWatcher(project.path, projectId, onEvent, filter);
  }

  private startWatcher(
    projectRoot: string,
    projectId: string,
    onEvent: (msg: WsMessage) => void,
    filter: PathFilter,
    forcePolling = false,
  ): void {
    const usePolling = forcePolling || this.configRef.current.watcher.usePolling;

    this.watcher = chokidar.watch(projectRoot, {
      ignored: makeIgnored(IGNORED_DIRS, projectRoot, filter),
      persistent: true,
      ignoreInitial: true,
      usePolling,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 50,
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
        } else {
          console.error('[notebook] watcher error:', err);
        }
      });
  }

  deactivate(): void {
    // Cancel any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      this.watcher.close().catch(() => {});
      this.watcher = null;
    }
    this.activeProjectId = null;
  }

  destroy(): void {
    this.deactivate();
  }
}
