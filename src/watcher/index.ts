import chokidar, { type FSWatcher } from 'chokidar';
import fs from 'node:fs';
import path from 'node:path';
import type { NotebookConfig, WsMessage } from '../types/index.js';

const IGNORED_DIRS = [
  /(^|[/\\])\../, // dotfiles / dotdirs
  /node_modules/,
  /[/\\](dist|build|\.next|target|\.venv)[/\\]/,
  /[/\\](dist|build|\.next|target|\.venv)$/,
];

/**
 * Returns true if the path should be ignored by the watcher.
 * For file entries (not directories), also rejects non-.md files.
 */
function makeIgnored(ignoredDirs: (RegExp | ((f: string, stats?: fs.Stats) => boolean))[]) {
  return [
    ...ignoredDirs,
    (filePath: string, stats?: fs.Stats) => {
      // Don't filter out directories — chokidar needs to descend into them
      if (!stats || stats.isDirectory()) return false;
      return !filePath.toLowerCase().endsWith('.md');
    },
  ];
}

export class WatcherManager {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeProjectId: string | null = null;
  private usePolling: boolean;
  private projects: NotebookConfig['projects'];

  constructor(private config: NotebookConfig) {
    this.usePolling = config.watcher.usePolling;
    this.projects = config.projects;
  }

  activate(projectId: string, onEvent: (msg: WsMessage) => void): void {
    // Tear down existing watcher before switching projects
    this.deactivate();

    const project = this.projects.find((p) => p.id === projectId);
    if (!project) {
      console.warn(`[notebook] watcher: unknown project id "${projectId}"`);
      return;
    }

    this.activeProjectId = projectId;
    this.startWatcher(project.path, projectId, onEvent);
  }

  private startWatcher(
    projectRoot: string,
    projectId: string,
    onEvent: (msg: WsMessage) => void,
    forcePolling = false,
  ): void {
    const usePolling = forcePolling || this.usePolling;

    this.watcher = chokidar.watch(projectRoot, {
      ignored: makeIgnored(IGNORED_DIRS),
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
          this.startWatcher(projectRoot, projectId, onEvent, true);
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
