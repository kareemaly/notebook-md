import type { SearchResult } from '../types/index.js';
import { searchWithFallback } from './fallback.js';
import { searchWithRipgrep } from './ripgrep.js';

export async function search(
  projectRoot: string,
  projectId: string,
  query: string,
  mode: 'filename' | 'content',
): Promise<SearchResult[]> {
  const rgResult = await searchWithRipgrep(projectRoot, projectId, query, mode);
  if (rgResult !== null) {
    return rgResult;
  }
  return searchWithFallback(projectRoot, projectId, query, mode);
}
