import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { NotebookConfig, ProjectConfig } from '../types/index.js';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ProjectSchema = z.object({
  name: z.string().min(1, 'Project name must not be empty'),
  path: z.string().min(1, 'Project path must not be empty'),
  include: z.array(z.string().min(1)).optional(),
  exclude: z.array(z.string().min(1)).optional(),
});

const ConfigSchema = z.object({
  port: z.number().int().positive().default(9001),
  projects: z.array(ProjectSchema).default([]),
  watcher: z
    .object({
      usePolling: z.boolean().default(false),
    })
    .default({}),
});

// ---------------------------------------------------------------------------
// Tilde expansion
// ---------------------------------------------------------------------------

export function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export const XDG_CONFIG_PATH = path.join(os.homedir(), '.config', 'notebook', 'config.json');

const DISCOVERY_PATHS = [
  path.resolve(process.cwd(), 'notebook.config.json'),
  XDG_CONFIG_PATH,
];

function findConfigFile(): string | null {
  for (const candidate of DISCOVERY_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readConfigFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function readRawConfig(filePath: string): unknown {
  return readConfigFile(filePath);
}

export function writeRawConfig(filePath: string, raw: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface LoadConfigResult {
  config: NotebookConfig;
  configFilePath: string | null;
}

export async function loadConfig(explicitPath?: string): Promise<LoadConfigResult> {
  let raw: unknown = {};
  let resolvedConfigPath: string | null = null;

  if (explicitPath) {
    const resolved = path.resolve(process.cwd(), explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    resolvedConfigPath = resolved;
    raw = readConfigFile(resolved);
  } else {
    const found = findConfigFile();
    if (found) {
      resolvedConfigPath = found;
      raw = readConfigFile(found);
    }
    // If no file found, raw stays {} and defaults kick in
  }

  // Validate and apply defaults
  const parsed = ConfigSchema.parse(raw);

  // Expand tildes in project paths and assign stable IDs
  const projects: ProjectConfig[] = parsed.projects.map((p, i) => ({
    id: String(i),
    name: p.name,
    path: expandTilde(p.path),
    include: p.include,
    exclude: p.exclude,
  }));

  return {
    config: {
      port: parsed.port,
      projects,
      watcher: {
        usePolling: parsed.watcher.usePolling,
      },
    },
    configFilePath: resolvedConfigPath,
  };
}

// Re-export ZodError so CLI can import it from one place
export { ZodError } from 'zod';
