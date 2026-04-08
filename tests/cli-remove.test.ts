import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRawConfig, writeRawConfig } from '../src/config/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RawProject = { name: string; path: string };
type RawConfig = { port?: number; projects?: RawProject[] };

function seedConfig(configPath: string, projects: RawProject[]): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  writeRawConfig(configPath, { port: 9001, projects });
}

/**
 * Core remove logic extracted from buildRemoveCommand for unit testing.
 * Returns an error string on failure instead of calling process.exit().
 */
function runRemove(
  configPath: string | null,
  nameOrIndex: string,
): { ok: true; removed: string } | { ok: false; error: string } {
  if (!configPath || !fs.existsSync(configPath)) {
    return { ok: false, error: 'No config file found.' };
  }

  const rawJson = readRawConfig(configPath) as RawConfig;
  const projects: RawProject[] = Array.isArray(rawJson.projects) ? rawJson.projects : [];

  const isIndex = /^\d+$/.test(nameOrIndex);
  let removeIdx = -1;

  if (isIndex) {
    const idx = parseInt(nameOrIndex, 10);
    if (idx < projects.length) removeIdx = idx;
  } else {
    removeIdx = projects.findIndex((p) => p.name === nameOrIndex);
  }

  if (removeIdx === -1) {
    return { ok: false, error: `Project "${nameOrIndex}" not found.` };
  }

  const removed = projects[removeIdx];
  projects.splice(removeIdx, 1);
  writeRawConfig(configPath, { ...rawJson, projects });

  return { ok: true, removed: removed.name };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notebook remove', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-remove-test-'));
    configPath = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes by name and leaves others intact', () => {
    seedConfig(configPath, [
      { name: 'Alpha', path: '/a' },
      { name: 'Beta', path: '/b' },
      { name: 'Gamma', path: '/c' },
    ]);

    const result = runRemove(configPath, 'Beta');
    expect(result).toMatchObject({ ok: true, removed: 'Beta' });

    const raw = readRawConfig(configPath) as RawConfig;
    expect(raw.projects).toHaveLength(2);
    expect(raw.projects!.map((p) => p.name)).toEqual(['Alpha', 'Gamma']);
  });

  it('removes by numeric index', () => {
    seedConfig(configPath, [
      { name: 'First', path: '/1' },
      { name: 'Second', path: '/2' },
      { name: 'Third', path: '/3' },
    ]);

    const result = runRemove(configPath, '1'); // 0-based index → "Second"
    expect(result).toMatchObject({ ok: true, removed: 'Second' });

    const raw = readRawConfig(configPath) as RawConfig;
    expect(raw.projects!.map((p) => p.name)).toEqual(['First', 'Third']);
  });

  it('removes first entry with index 0', () => {
    seedConfig(configPath, [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
    ]);

    const result = runRemove(configPath, '0');
    expect(result).toMatchObject({ ok: true, removed: 'A' });

    const raw = readRawConfig(configPath) as RawConfig;
    expect(raw.projects!.map((p) => p.name)).toEqual(['B']);
  });

  it('returns error when name is not found', () => {
    seedConfig(configPath, [{ name: 'Alpha', path: '/a' }]);

    const result = runRemove(configPath, 'Nonexistent');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('not found') });

    // Config unchanged
    const raw = readRawConfig(configPath) as RawConfig;
    expect(raw.projects).toHaveLength(1);
  });

  it('returns error when index is out of bounds', () => {
    seedConfig(configPath, [{ name: 'Only', path: '/only' }]);

    const result = runRemove(configPath, '5');
    expect(result).toMatchObject({ ok: false });
  });

  it('returns error when no config file exists', () => {
    const result = runRemove(null, 'Any');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('No config file') });
  });

  it('preserves other config fields after remove', () => {
    writeRawConfig(configPath, {
      port: 8080,
      watcher: { usePolling: true },
      projects: [
        { name: 'Keep', path: '/keep' },
        { name: 'Remove', path: '/remove' },
      ],
    });

    runRemove(configPath, 'Remove');

    const raw = readRawConfig(configPath) as RawConfig & { watcher?: { usePolling: boolean } };
    expect(raw.port).toBe(8080);
    expect(raw.watcher?.usePolling).toBe(true);
    expect(raw.projects).toHaveLength(1);
  });
});
