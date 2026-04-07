import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFile } from '@/api';
import type { FileResponse } from '@/types';

export function useFile(projectId: string | null, filePath: string | null) {
  const [fileData, setFileData] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const load = useCallback(
    (pid: string, fp: string) => {
      const key = `${pid}::${fp}`;
      keyRef.current = key;
      setLoading(true);
      setError(null);
      fetchFile(pid, fp)
        .then((data) => {
          if (keyRef.current === key) setFileData(data);
        })
        .catch((err: unknown) => {
          if (keyRef.current === key)
            setError(err instanceof Error ? err.message : 'Failed to load file');
        })
        .finally(() => {
          if (keyRef.current === key) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (!projectId || !filePath) {
      setFileData(null);
      setError(null);
      return;
    }
    load(projectId, filePath);
  }, [projectId, filePath, load]);

  const refetch = useCallback(() => {
    if (projectId && filePath) load(projectId, filePath);
  }, [projectId, filePath, load]);

  return { fileData, loading, error, refetch };
}
