import { spawn } from 'node:child_process';
import path from 'node:path';
import type { SearchResult } from '../types/index.js';

const RG_TIMEOUT_MS = 10_000;

/**
 * Check if `rg` is available on PATH by attempting a no-op invocation.
 * Returns true if rg is found, false if ENOENT.
 */
async function isRgAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('rg', ['--version'], { stdio: 'ignore' });
    child.on('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code !== 'ENOENT' ? true : false);
    });
    child.on('close', () => resolve(true));
  });
}

/**
 * Run a ripgrep command and collect stdout as a string.
 * Returns null if rg is not available (ENOENT) or times out.
 */
function runRg(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('rg', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }

    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, RG_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        resolve(null);
      } else {
        resolve(stdout); // partial output still useful
      }
    });

    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout);
    });
  });
}

export async function searchWithRipgrep(
  projectRoot: string,
  projectId: string,
  query: string,
  mode: 'filename' | 'content',
): Promise<SearchResult[] | null> {
  const available = await isRgAvailable();
  if (!available) return null;

  if (mode === 'filename') {
    // List all .md files, then filter by filename in JS
    // (avoids shell-interpolating the query into a glob pattern)
    const output = await runRg(['--files', '-g', '*.md', projectRoot]);
    if (output === null) return null;

    const lowerQuery = query.toLowerCase();
    return output
      .split('\n')
      .filter((line) => line && path.basename(line).toLowerCase().includes(lowerQuery))
      .map((absPath) => ({
        projectId,
        filePath: path.relative(projectRoot, absPath),
      }));
  } else {
    // Content search: rg --line-number --no-heading --with-filename
    // query is passed as a positional argument — no shell interpolation
    const output = await runRg([
      '--line-number',
      '--no-heading',
      '--with-filename',
      '--type',
      'md',
      query,
      projectRoot,
    ]);
    if (output === null) return null;

    const results: SearchResult[] = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      // Format: /abs/path/file.md:linenum:matched content
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) continue;
      const [, absPath, lineStr, snippet] = match;
      results.push({
        projectId,
        filePath: path.relative(projectRoot, absPath),
        line: parseInt(lineStr, 10),
        snippet,
      });
    }
    return results;
  }
}
