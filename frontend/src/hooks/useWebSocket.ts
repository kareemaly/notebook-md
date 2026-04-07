import { useEffect, useRef, useState } from 'react';
import type { WSReloadMessage, WSStatus } from '@/types';

const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];

function nextDelay(attempt: number) {
  return BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
}

export function useWebSocket(
  projectId: string | null,
  onReload: (msg: WSReloadMessage) => void,
) {
  const [status, setStatus] = useState<WSStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);
  const attemptRef = useRef(0);
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  useEffect(() => {
    destroyedRef.current = false;

    function openSocket() {
      if (destroyedRef.current) return;
      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyedRef.current) {
          ws.close();
          return;
        }
        attemptRef.current = 0;
        setStatus('open');
        if (projectId) {
          ws.send(JSON.stringify({ type: 'activate', projectId }));
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type: string };
          if (msg.type === 'reload') {
            onReloadRef.current(msg as WSReloadMessage);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (destroyedRef.current) return;
        setStatus('reconnecting');
        const delay = nextDelay(attemptRef.current++);
        timerRef.current = setTimeout(openSocket, delay);
      };
    }

    openSocket();

    return () => {
      destroyedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // socket lifecycle is independent of projectId changes

  // When projectId changes, re-send activate on the existing open socket
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !projectId) return;
    ws.send(JSON.stringify({ type: 'activate', projectId }));
  }, [projectId]);

  return { status };
}
