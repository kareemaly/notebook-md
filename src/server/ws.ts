import type http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { NotebookConfig, WsMessage } from '../types/index.js';
import { WatcherManager } from '../watcher/index.js';

interface ActivateMessage {
  type: 'activate';
  projectId: string;
}

function isActivateMessage(data: unknown): data is ActivateMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'activate' &&
    typeof (data as Record<string, unknown>).projectId === 'string'
  );
}

export function attachWebSocket(server: http.Server, config: NotebookConfig): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const watcherManager = new WatcherManager(config);

  function broadcast(msg: WsMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (socket) => {
    // Confirm connection is live
    socket.send(JSON.stringify({ type: 'ping' } satisfies WsMessage));

    socket.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (isActivateMessage(parsed)) {
        watcherManager.activate(parsed.projectId, broadcast);
      }
    });

    socket.on('close', () => {
      // If no clients remain, stop watching to conserve inotify resources
      const remaining = [...wss.clients].filter((c) => c.readyState === WebSocket.OPEN);
      if (remaining.length === 0) {
        watcherManager.deactivate();
      }
    });
  });

  wss.on('close', () => {
    watcherManager.destroy();
  });

  return wss;
}
