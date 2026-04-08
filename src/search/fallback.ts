import fs from 'node:fs/promises';
import path from 'node:path';
import type { PathFilter } from '../projectFilter.js';
import { isSupportedFile } from '../supportedFormats.js';
import type { SearchResult } from '../types/index.js';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'target',
  '.venv',
]);

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name.startsWith('.');
}

async function collectSupportedFiles(
  dir: string,
  rootDir: string,
  filter: PathFilter | undefined,
): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(rootDir, abs);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue;
      if (filter && !filter.acceptsDir(rel)) continue;
      const nested = await collectSupportedFiles(abs, rootDir, filter);
      files.push(...nested);
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
      if (filter && !filter.acceptsFile(rel)) continue;
      files.push(abs);
    }
  }
  return files;
}

export async function searchWithFallback(
  projectRoot: string,
  projectId: string,
  query: string,
  mode: 'filename' | 'content',
  caseSensitive: boolean,
  filter?: PathFilter,
): Promise<SearchResult[]> {
  const allFiles = await collectSupportedFiles(projectRoot, projectRoot, filter);
  const needle = caseSensitive ? query : query.toLowerCase();
  const prep = (s: string) => (caseSensitive ? s : s.toLowerCase());
  const results: SearchResult[] = [];

  if (mode === 'filename') {
    for (const absPath of allFiles) {
      if (prep(path.basename(absPath)).includes(needle)) {
        results.push({
          projectId,
          filePath: path.relative(projectRoot, absPath),
        });
      }
    }
  } else {
    for (const absPath of allFiles) {
      let content: string;
      try {
        content = await fs.readFile(absPath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (prep(lines[i]).includes(needle)) {
          // Collect ±1 line of context
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(start, end + 1).join('\n');

          results.push({
            projectId,
            filePath: path.relative(projectRoot, absPath),
            line: i + 1, // 1-based
            snippet,
          });
        }
      }
    }
  }

  return results;
}
