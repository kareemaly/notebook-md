import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function spawnCLI(
  args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(repoRoot, 'bin/notebook.js'), ...args], {
      env: process.env,
      cwd: repoRoot,
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

describe('CLI --version', () => {
  it('reports the version from package.json', async () => {
    const pkgPath = path.join(repoRoot, 'package.json');
    const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };

    const { exitCode, stdout } = await spawnCLI(['--version']);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(version);
  });
});
