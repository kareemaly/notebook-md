import { useEffect, useRef, useState } from 'react';
import { fetchSearch } from '@/api';
import type { SearchMode, SearchResult } from '@/types';

export function useSearch(
  projectId: string | null,
  query: string,
  mode: SearchMode,
  caseSensitive: boolean,
) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!projectId || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetchSearch(projectId, query, mode, caseSensitive, ctrl.signal)
        .then((data) => {
          setResults(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string }).name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [projectId, query, mode, caseSensitive]);

  return { results, loading, error };
}
