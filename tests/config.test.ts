import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock fs BEFORE importing the module under test.
// Vitest hoists vi.mock() calls automatically.
vi.mock('node:fs');

const mockFs = vi.mocked(fs);

const XDG_CONFIG = path.join(os.homedir(), '.config', 'notebook', 'config.json');

// Helper: set up mockFs.existsSync and mockFs.readFileSync for a given config JSON.
function mockConfigFile(filePath: string, content: unknown) {
  mockFs.existsSync.mockImplementation((p) => p === filePath);
  mockFs.readFileSync.mockImplementation((p) => {
    if (p === filePath) return JSON.stringify(content);
    throw new Error(`ENOENT: ${String(p)}`);
  });
}

function mockNoConfigFile() {
  mockFs.existsSync.mockReturnValue(false);
}

describe('loadConfig', () => {
  // Import dynamically so each test gets a fresh module evaluation
  // (mocks are in place before import due to vi.mock hoisting)
  let loadConfig: typeof import('../src/config/index.js').loadConfig;
  let ZodError: typeof import('../src/config/index.js').ZodError;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/config/index.js');
    loadConfig = mod.loadConfig;
    ZodError = mod.ZodError;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  it('returns defaults when no config file exists', async () => {
    mockNoConfigFile();
    const { config: cfg } = await loadConfig();
    expect(cfg.port).toBe(9001);
    expect(cfg.projects).toEqual([]);
    expect(cfg.watcher.usePolling).toBe(false);
  });

  // -------------------------------------------------------------------------
  it('loads ~/.config/notebook/config.json when present', async () => {
    mockConfigFile(XDG_CONFIG, { port: 7777, projects: [] });

    const { config: cfg } = await loadConfig();
    expect(cfg.port).toBe(7777);
  });

  // -------------------------------------------------------------------------
  it('does not pick up notebook.config.json from cwd', async () => {
    const cwdConfig = path.resolve(process.cwd(), 'notebook.config.json');
    mockConfigFile(cwdConfig, { port: 4242, projects: [] });

    // cwd config should be ignored — no XDG file means defaults are used
    const { config: cfg, configFilePath } = await loadConfig();
    expect(cfg.port).toBe(9001);
    expect(configFilePath).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('uses explicitPath over discovery', async () => {
    const explicitPath = '/tmp/my-notebook.json';
    mockFs.existsSync.mockImplementation((p) => p === explicitPath);
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === explicitPath) return JSON.stringify({ port: 1234, projects: [] });
      throw new Error(`ENOENT: ${String(p)}`);
    });

    const { config: cfg } = await loadConfig(explicitPath);
    expect(cfg.port).toBe(1234);
  });

  // -------------------------------------------------------------------------
  it('throws when explicit path does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);
    await expect(loadConfig('/nonexistent/path.json')).rejects.toThrow('Config file not found');
  });

  // -------------------------------------------------------------------------
  it('expands tilde in project paths', async () => {
    mockConfigFile(XDG_CONFIG, {
      projects: [{ name: 'Notes', path: '~/notes' }],
    });

    const { config: cfg } = await loadConfig();
    expect(cfg.projects[0].path).toBe(path.join(os.homedir(), 'notes'));
  });

  // -------------------------------------------------------------------------
  it('assigns stable numeric string IDs to projects', async () => {
    mockConfigFile(XDG_CONFIG, {
      projects: [
        { name: 'A', path: '/a' },
        { name: 'B', path: '/b' },
      ],
    });

    const { config: cfg } = await loadConfig();
    expect(cfg.projects[0].id).toBe('0');
    expect(cfg.projects[1].id).toBe('1');
  });

  // -------------------------------------------------------------------------
  it('throws ZodError when config has invalid schema', async () => {
    mockConfigFile(XDG_CONFIG, { port: 'not-a-number' });

    await expect(loadConfig()).rejects.toThrow(ZodError);
  });

  // -------------------------------------------------------------------------
  it('accepts partial config and fills in defaults', async () => {
    mockConfigFile(XDG_CONFIG, {
      projects: [{ name: 'Docs', path: '/docs' }],
    });

    const { config: cfg } = await loadConfig();
    expect(cfg.port).toBe(9001);
    expect(cfg.watcher.usePolling).toBe(false);
    expect(cfg.projects).toHaveLength(1);
  });
});
