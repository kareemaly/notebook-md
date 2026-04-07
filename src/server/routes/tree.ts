import type { Router } from 'express';
import { Router as createRouter } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { FileNode, NotebookConfig } from '../../types/index.js';

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

/**
 * Recursively build a FileNode tree for a directory.
 * Returns dirs first (alpha), then files (alpha), .md only.
 * Exported for use in tests.
 */
export function buildFileTree(dir: string, rootDir: string): FileNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) {
        const children = buildFileTree(path.join(dir, entry.name), rootDir);
        dirs.push({ type: 'dir', name: entry.name, children });
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const absPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, absPath);
      files.push({ type: 'file', name: entry.name, path: relPath });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export function treeRouter(config: NotebookConfig): Router {
  const router = createRouter();

  // GET /api/projects/:id/tree
  router.get('/:id/tree', (req, res) => {
    const project = config.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const tree = buildFileTree(project.path, project.path);
    res.json(tree);
  });

  return router;
}
