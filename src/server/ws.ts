import chokidar from 'chokidar';
import type http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from '../config/index.js';
import type { ConfigRef, NotebookConfig, WsMessage } from '../types/index.js';
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

export function attachWebSocket(
  server: http.Server,
  configRef: ConfigRef,
  configFilePath: string | null,
  onConfigReload: (newConfig: NotebookConfig) => void,
): { wss: WebSocketServer; watcherManager: WatcherManager } {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const watcherManager = new WatcherManager(configRef);

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

  // Config file hot-reload (separate from markdown watcher)
  if (configFilePath) {
    const cfgWatcher = chokidar.watch(configFilePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    cfgWatcher.on('change', async () => {
      let newConfig: NotebookConfig;
      try {
        const result = await loadConfig(configFilePath);
        newConfig = result.config;
      } catch (err) {
        console.error('[notebook] config reload failed — keeping previous config:', err);
        return;
      }

      if (newConfig.port !== configRef.current.port) {
        console.warn(
          '[notebook] port changed in config — restart required for port change to take effect',
        );
        newConfig = { ...newConfig, port: configRef.current.port };
      }

      onConfigReload(newConfig);
      broadcast({
        type: 'config-reload',
        projects: newConfig.projects.map((p) => ({ id: p.id, name: p.name })),
      });
    });
    // Ignore 'unlink' — don't crash if config file is deleted

    wss.on('close', () => {
      cfgWatcher.close().catch(() => {});
    });
  }

  wss.on('close', () => {
    watcherManager.destroy();
  });

  return { wss, watcherManager };
}
