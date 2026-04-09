import { useCallback, useEffect, useState } from 'react';
import { fetchTree } from '@/api';
import type { FileNode } from '@/types';

export function useFileTree(projectId: string | null) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!projectId) {
      setTree([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchTree(projectId)
      .then((data) => setTree(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load tree'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setTree([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTree(projectId)
      .then((data) => {
        if (!cancelled) setTree(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tree');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { tree, loading, error, refetch };
}
