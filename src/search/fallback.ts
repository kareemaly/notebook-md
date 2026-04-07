import fs from 'node:fs/promises';
import path from 'node:path';
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

async function collectMdFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) {
        const nested = await collectMdFiles(path.join(dir, entry.name));
        files.push(...nested);
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

export async function searchWithFallback(
  projectRoot: string,
  projectId: string,
  query: string,
  mode: 'filename' | 'content',
): Promise<SearchResult[]> {
  const allFiles = await collectMdFiles(projectRoot);
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  if (mode === 'filename') {
    for (const absPath of allFiles) {
      if (path.basename(absPath).toLowerCase().includes(lowerQuery)) {
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
        if (lines[i].toLowerCase().includes(lowerQuery)) {
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
