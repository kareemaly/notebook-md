import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI smoke — spawns the built binary end-to-end
// ---------------------------------------------------------------------------

function spawnCLI(
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(repoRoot, 'bin/notebook.js'), ...args], {
      env,
      cwd,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d;
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d;
    });
    proc.on('close', (code) => resolve({ exitCode: code ?? 0, stdout, stderr }));
    proc.on('error', reject);
  });
}

describe('CLI smoke', () => {
  let tmpHome: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-smoke-'));
    env = { ...process.env, HOME: tmpHome };
  });

  afterAll(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('notebook list exits 0 with no config', async () => {
    const { exitCode, stdout } = await spawnCLI(['list'], env, tmpHome);
    expect(exitCode, `stderr: ${stdout}`).toBe(0);
    expect(stdout).toContain('No projects configured');
  });
});

// ---------------------------------------------------------------------------
// Server smoke — boots Express from the *built* dist in-process
//
// Importing from dist/ means import.meta.url resolves from dist/server/,
// which is the correct runtime path. This directly catches the wrong-path
// bug (two ".." vs one "..") that would cause ENOENT on every page load.
//
// Skipped when dist/client/index.html is absent (pre-build dev environment).
// ---------------------------------------------------------------------------

const clientIndex = path.join(repoRoot, 'dist', 'client', 'index.html');
const hasBuiltClient = fs.existsSync(clientIndex);

describe.skipIf(!hasBuiltClient)('server smoke', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    // Dynamic import so the module-level import.meta.url in dist/server/app.js
    // resolves to dist/server/, not tests/.
    const { createApp } = await import('../dist/server/app.js');
    const configRef = {
      current: { port: 0, projects: [], watcher: { usePolling: false } },
    };
    const app = createApp(configRef);
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it('GET / returns 200 with HTML content', async () => {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      http
        .get(`http://localhost:${port}/`, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => {
            body += chunk;
          });
          res.on('end', () => resolve({ statusCode: res.statusCode!, body }));
        })
        .on('error', reject);
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.toLowerCase()).toContain('<!doctype html>');
  });
});
