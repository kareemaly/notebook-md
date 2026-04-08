export interface Project {
  id: string;
  name: string;
}

export interface FileNode {
  type: 'file' | 'dir';
  name: string;
  path?: string;
  children?: FileNode[];
}

export interface FileResponse {
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface SearchResult {
  projectId: string;
  filePath: string;
  line?: number;
  snippet?: string;
}

export type SearchMode = 'filename' | 'content';

export type WSStatus = 'connecting' | 'open' | 'reconnecting';

export interface WSReloadMessage {
  type: 'reload';
  path: string;
  event: 'change' | 'add' | 'unlink';
}

export interface WSConfigReloadMessage {
  type: 'config-reload';
  projects: Project[];
}
