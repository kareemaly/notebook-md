import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PathFilter } from '../projectFilter.js';
import { SUPPORTED_GLOBS } from '../supportedFormats.js';
import type { SearchResult } from '../types/index.js';

// Flatten ["*.md", "*.mdx"] → ["-g", "*.md", "-g", "*.mdx"] for ripgrep.
const RG_GLOB_ARGS: string[] = SUPPORTED_GLOBS.flatMap((g) => ['-g', g]);

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
  caseSensitive: boolean,
  filter?: PathFilter,
): Promise<SearchResult[] | null> {
  const available = await isRgAvailable();
  if (!available) return null;

  const accepts = (rel: string) => !filter || filter.acceptsFile(rel);

  if (mode === 'filename') {
    // List all supported files, then filter by filename in JS
    // (avoids shell-interpolating the query into a glob pattern)
    const output = await runRg(['--files', ...RG_GLOB_ARGS, projectRoot]);
    if (output === null) return null;

    const needle = caseSensitive ? query : query.toLowerCase();
    const prep = (s: string) => (caseSensitive ? s : s.toLowerCase());
    const results: SearchResult[] = [];
    for (const line of output.split('\n')) {
      if (!line) continue;
      if (!prep(path.basename(line)).includes(needle)) continue;
      const rel = path.relative(projectRoot, line);
      if (!accepts(rel)) continue;
      results.push({ projectId, filePath: rel });
    }
    return results;
  } else {
    // Content search: rg --line-number --no-heading --with-filename
    // query is passed as a positional argument — no shell interpolation.
    // Default rg behaviour is case-sensitive; add -i for insensitive.
    const output = await runRg([
      '--line-number',
      '--no-heading',
      '--with-filename',
      ...(caseSensitive ? [] : ['-i']),
      ...RG_GLOB_ARGS,
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
      const rel = path.relative(projectRoot, absPath);
      if (!accepts(rel)) continue;
      results.push({
        projectId,
        filePath: rel,
        line: parseInt(lineStr, 10),
        snippet,
      });
    }
    return results;
  }
}
