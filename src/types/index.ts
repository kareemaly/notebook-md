export interface ProjectConfig {
  id: string;
  name: string;
  path: string; // tilde-expanded absolute path
  /**
   * Path prefixes (relative to the project root, POSIX separators) to
   * include. If set and non-empty, only files whose relative path equals
   * or begins with one of these prefixes are exposed to the viewer.
   * Example: ["memory", "sessions", "specs/api"].
   */
  include?: string[];
  /**
   * Path prefixes to exclude. Evaluated after `include` — an excluded
   * prefix wins. Example: ["memory/drafts"].
   */
  exclude?: string[];
}

export interface WatcherConfig {
  usePolling: boolean;
  /** Maximum number of directories to watch per project. Default: 2000. */
  maxWatchedDirs?: number;
}

export interface NotebookConfig {
  port: number;
  projects: ProjectConfig[];
  watcher: WatcherConfig;
}

export interface FileNode {
  type: 'file' | 'dir';
  name: string;
  path?: string; // relative path from project root (files only)
  children?: FileNode[]; // dirs first, then files, both alpha-sorted
}

export interface FileResponse {
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface SearchResult {
  projectId: string;
  filePath: string; // relative to project root
  line?: number; // content mode only (1-based)
  snippet?: string; // content mode only — matching line ± 1 line of context
}

export interface ConfigRef {
  current: NotebookConfig;
}

export type WsMessage =
  | { type: 'reload'; path: string; event: 'change' | 'add' | 'unlink' }
  | { type: 'ping' }
  | { type: 'config-reload'; projects: { id: string; name: string }[] }
  | { type: 'watcher-warning'; projectId: string; message: string };
