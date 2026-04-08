import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chokidar
// ---------------------------------------------------------------------------

const fakeConfigWatcherEmitter = new EventEmitter() as EventEmitter & {
  close: () => Promise<void>;
};
fakeConfigWatcherEmitter.close = () => Promise.resolve();

const fakeMarkdownWatcherEmitter = new EventEmitter() as EventEmitter & {
  close: () => Promise<void>;
};
fakeMarkdownWatcherEmitter.close = () => Promise.resolve();

let chokidarCallIdx = 0;

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => {
      const idx = chokidarCallIdx++;
      return idx === 0 ? fakeConfigWatcherEmitter : fakeMarkdownWatcherEmitter;
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock loadConfig
// ---------------------------------------------------------------------------

vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(),
  expandTilde: (p: string) => p,
  XDG_CONFIG_PATH: '/mock/config.json',
  readRawConfig: vi.fn(),
  writeRawConfig: vi.fn(),
  ZodError: class ZodError extends Error {},
}));

// ---------------------------------------------------------------------------
// Mock ws — use require() for EventEmitter so the factory is self-contained
// ---------------------------------------------------------------------------

const mockClients = new Set<{ readyState: number; send: ReturnType<typeof vi.fn> }>();

vi.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require('events') as { EventEmitter: typeof import('events').EventEmitter };
  class MockWebSocketServer extends EE {
    clients = mockClients;
  }
  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: { OPEN: 1 },
  };
});

// ---------------------------------------------------------------------------
// Import under test (after all mocks)
// ---------------------------------------------------------------------------

import { loadConfig } from '../src/config/index.js';
import { attachWebSocket } from '../src/server/ws.js';
import type { ConfigRef, NotebookConfig } from '../src/types/index.js';

const mockedLoadConfig = vi.mocked(loadConfig);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigRef(overrides?: Partial<NotebookConfig>): ConfigRef {
  return {
    current: {
      port: 9001,
      projects: [{ id: '0', name: 'Test', path: '/tmp/test' }],
      watcher: { usePolling: false },
      ...overrides,
    },
  };
}

function makeServer() {
  return new EventEmitter() as unknown as import('node:http').Server;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config hot-reload', () => {
  beforeEach(() => {
    chokidarCallIdx = 0;
    fakeConfigWatcherEmitter.removeAllListeners();
    fakeMarkdownWatcherEmitter.removeAllListeners();
    mockClients.clear();
    mockedLoadConfig.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  it('does not create a chokidar watcher when configFilePath is null', () => {
    attachWebSocket(makeServer(), makeConfigRef(), null, vi.fn());
    expect(chokidarCallIdx).toBe(0);
  });

  // -------------------------------------------------------------------------
  it('creates a config file watcher when configFilePath is provided', () => {
    attachWebSocket(makeServer(), makeConfigRef(), '/some/config.json', vi.fn());
    expect(chokidarCallIdx).toBe(1);
  });

  // -------------------------------------------------------------------------
  it('calls onConfigReload and broadcasts config-reload on valid config change', async () => {
    const newConfig: NotebookConfig = {
      port: 9001,
      projects: [
        { id: '0', name: 'Updated', path: '/tmp/updated' },
        { id: '1', name: 'NewProject', path: '/tmp/new' },
      ],
      watcher: { usePolling: false },
    };
    mockedLoadConfig.mockResolvedValue({ config: newConfig, configFilePath: '/config.json' });

    const configRef = makeConfigRef();
    const onConfigReload = vi.fn();
    const mockClient = { readyState: 1, send: vi.fn() };
    mockClients.add(mockClient);

    attachWebSocket(makeServer(), configRef, '/config.json', onConfigReload);

    fakeConfigWatcherEmitter.emit('change');
    await new Promise((r) => setTimeout(r, 0));

    expect(onConfigReload).toHaveBeenCalledWith(newConfig);
    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'config-reload',
        projects: [
          { id: '0', name: 'Updated' },
          { id: '1', name: 'NewProject' },
        ],
      }),
    );
  });

  // -------------------------------------------------------------------------
  it('does not call onConfigReload when loadConfig throws (validation error)', async () => {
    mockedLoadConfig.mockRejectedValue(new Error('Invalid config: port must be positive'));

    const configRef = makeConfigRef();
    const originalConfig = { ...configRef.current };
    const onConfigReload = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    attachWebSocket(makeServer(), configRef, '/config.json', onConfigReload);

    fakeConfigWatcherEmitter.emit('change');
    await new Promise((r) => setTimeout(r, 0));

    expect(onConfigReload).not.toHaveBeenCalled();
    expect(configRef.current).toEqual(originalConfig);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('config reload failed'),
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  // -------------------------------------------------------------------------
  it('resets port to current value when config file changes port', async () => {
    const newConfigWithPortChange: NotebookConfig = {
      port: 8080, // different from current 9001
      projects: [{ id: '0', name: 'Test', path: '/tmp/test' }],
      watcher: { usePolling: false },
    };
    mockedLoadConfig.mockResolvedValue({
      config: newConfigWithPortChange,
      configFilePath: '/cfg.json',
    });

    const configRef = makeConfigRef({ port: 9001 });
    const onConfigReload = vi.fn();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    attachWebSocket(makeServer(), configRef, '/cfg.json', onConfigReload);

    fakeConfigWatcherEmitter.emit('change');
    await new Promise((r) => setTimeout(r, 0));

    expect(onConfigReload).toHaveBeenCalledWith(expect.objectContaining({ port: 9001 }));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('restart'));

    consoleWarn.mockRestore();
  });

  // -------------------------------------------------------------------------
  it('broadcast includes correct project list from reloaded config', async () => {
    const reloadedConfig: NotebookConfig = {
      port: 9001,
      projects: [{ id: '0', name: 'Solo', path: '/solo' }],
      watcher: { usePolling: false },
    };
    mockedLoadConfig.mockResolvedValue({ config: reloadedConfig, configFilePath: '/cfg.json' });

    const mockClient = { readyState: 1, send: vi.fn() };
    mockClients.add(mockClient);

    attachWebSocket(makeServer(), makeConfigRef(), '/cfg.json', vi.fn());

    fakeConfigWatcherEmitter.emit('change');
    await new Promise((r) => setTimeout(r, 0));

    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'config-reload', projects: [{ id: '0', name: 'Solo' }] }),
    );
  });
});
