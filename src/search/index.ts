import type { PathFilter } from '../projectFilter.js';
import type { SearchResult } from '../types/index.js';
import { searchWithFallback } from './fallback.js';
import { searchWithRipgrep } from './ripgrep.js';

export async function search(
  projectRoot: string,
  projectId: string,
  query: string,
  mode: 'filename' | 'content',
  caseSensitive: boolean,
  filter?: PathFilter,
): Promise<SearchResult[]> {
  const rgResult = await searchWithRipgrep(
    projectRoot,
    projectId,
    query,
    mode,
    caseSensitive,
    filter,
  );
  if (rgResult !== null) {
    return rgResult;
  }
  return searchWithFallback(projectRoot, projectId, query, mode, caseSensitive, filter);
}
