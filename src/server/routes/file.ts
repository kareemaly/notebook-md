import type { Router } from 'express';
import { Router as createRouter } from 'express';
import matter from 'gray-matter';
import fs from 'node:fs';
import { createPathFilter } from '../../projectFilter.js';
import type { ConfigRef } from '../../types/index.js';
import { resolveSafePath } from '../pathUtils.js';

export function fileRouter(configRef: ConfigRef): Router {
  const router = createRouter();

  // GET /api/projects/:id/file?path=...
  router.get('/:id/file', (req, res) => {
    const project = configRef.current.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const rawPath = req.query.path;
    if (typeof rawPath !== 'string' || !rawPath) {
      res.status(400).json({ error: 'Missing required query parameter: path' });
      return;
    }

    const filter = createPathFilter(project.include, project.exclude);
    const resolved = resolveSafePath(project.path, rawPath, filter);
    if (!resolved) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    let raw: string;
    try {
      raw = fs.readFileSync(resolved, 'utf8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.status(500).json({ error: 'Failed to read file' });
      }
      return;
    }

    const parsed = matter(raw);
    res.json({
      raw,
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
    });
  });

  return router;
}
