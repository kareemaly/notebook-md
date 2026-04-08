import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRawConfig, writeRawConfig, XDG_CONFIG_PATH } from '../src/config/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal re-implementation of the add command's core logic, parameterised
 * so tests can inject temp paths without touching the real home directory or
 * the real cwd notebook.config.json.
 */
async function runAdd(
  rawPath: string,
  name: string | undefined,
  targetPath: string,
): Promise<void> {
  const resolvedName = name ?? path.basename(path.resolve(rawPath));

  let rawJson: Record<string, unknown> = {};
  if (fs.existsSync(targetPath)) {
    rawJson = readRawConfig(targetPath) as Record<string, unknown>;
  }

  const projects: unknown[] = Array.isArray(rawJson.projects) ? rawJson.projects : [];
  projects.push({ name: resolvedName, path: rawPath });

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  writeRawConfig(targetPath, { ...rawJson, projects });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notebook add', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-add-test-'));
    configPath = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates config file when none exists', async () => {
    expect(fs.existsSync(configPath)).toBe(false);

    await runAdd('/some/project', undefined, configPath);

    expect(fs.existsSync(configPath)).toBe(true);
    const raw = readRawConfig(configPath) as { projects: { name: string; path: string }[] };
    expect(raw.projects).toHaveLength(1);
    expect(raw.projects[0].name).toBe('project');
    expect(raw.projects[0].path).toBe('/some/project');
  });

  it('appends to existing config file', async () => {
    writeRawConfig(configPath, { port: 9002, projects: [{ name: 'Existing', path: '/existing' }] });

    await runAdd('/new/project', 'New', configPath);

    const raw = readRawConfig(configPath) as { port: number; projects: { name: string }[] };
    expect(raw.port).toBe(9002); // preserves existing fields
    expect(raw.projects).toHaveLength(2);
    expect(raw.projects[1].name).toBe('New');
  });

  it('uses --name when provided', async () => {
    await runAdd('/some/path', 'Custom Name', configPath);

    const raw = readRawConfig(configPath) as { projects: { name: string }[] };
    expect(raw.projects[0].name).toBe('Custom Name');
  });

  it('defaults name to basename of path', async () => {
    await runAdd('/notes/personal', undefined, configPath);

    const raw = readRawConfig(configPath) as { projects: { name: string }[] };
    expect(raw.projects[0].name).toBe('personal');
  });

  it('accumulates multiple projects without clobbering', async () => {
    await runAdd('/first', 'First', configPath);
    await runAdd('/second', 'Second', configPath);
    await runAdd('/third', 'Third', configPath);

    const raw = readRawConfig(configPath) as { projects: { name: string }[] };
    expect(raw.projects).toHaveLength(3);
    expect(raw.projects.map((p) => p.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('stores original path as-is (tilde not expanded)', async () => {
    await runAdd('~/notes', 'Notes', configPath);

    const raw = readRawConfig(configPath) as { projects: { path: string }[] };
    expect(raw.projects[0].path).toBe('~/notes');
  });

  it('exports XDG_CONFIG_PATH pointing to ~/.config/notebook/config.json', () => {
    expect(XDG_CONFIG_PATH).toBe(path.join(os.homedir(), '.config', 'notebook', 'config.json'));
  });
});
