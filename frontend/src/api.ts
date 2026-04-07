import type { FileNode, FileResponse, Project, SearchMode, SearchResult } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function fetchProjects(): Promise<Project[]> {
  return json<Project[]>(await fetch('/api/projects'));
}

export async function fetchTree(projectId: string): Promise<FileNode[]> {
  return json<FileNode[]>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/tree`));
}

export async function fetchFile(projectId: string, filePath: string): Promise<FileResponse> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(filePath)}`;
  return json<FileResponse>(await fetch(url));
}

export async function fetchSearch(
  projectId: string,
  query: string,
  mode: SearchMode,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/search?q=${encodeURIComponent(query)}&mode=${mode}`;
  return json<SearchResult[]>(await fetch(url, { signal }));
}
