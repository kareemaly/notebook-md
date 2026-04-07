export interface ProjectConfig {
  id: string;
  name: string;
  path: string; // tilde-expanded absolute path
}

export interface WatcherConfig {
  usePolling: boolean;
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

export type WsMessage =
  | { type: 'reload'; path: string; event: 'change' | 'add' | 'unlink' }
  | { type: 'ping' };
