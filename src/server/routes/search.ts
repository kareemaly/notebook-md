import type { Router } from 'express';
import { Router as createRouter } from 'express';
import { createPathFilter } from '../../projectFilter.js';
import { search } from '../../search/index.js';
import type { NotebookConfig } from '../../types/index.js';

export function searchRouter(config: NotebookConfig): Router {
  const router = createRouter();

  // GET /api/projects/:id/search?q=...&mode=filename|content
  router.get('/:id/search', async (req, res) => {
    const project = config.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const q = req.query.q;
    if (typeof q !== 'string' || !q.trim()) {
      res.status(400).json({ error: 'Missing or empty query parameter: q' });
      return;
    }

    const rawMode = req.query.mode;
    if (rawMode !== undefined && rawMode !== 'filename' && rawMode !== 'content') {
      res.status(400).json({ error: 'Invalid mode: must be "filename" or "content"' });
      return;
    }
    const mode: 'filename' | 'content' = rawMode ?? 'filename';

    // `cs=1` / `cs=true` → case-sensitive. Default is insensitive.
    const rawCs = req.query.cs;
    const caseSensitive = rawCs === '1' || rawCs === 'true';

    try {
      const filter = createPathFilter(project.include, project.exclude);
      const results = await search(
        project.path,
        project.id,
        q.trim(),
        mode,
        caseSensitive,
        filter,
      );
      res.json(results);
    } catch (err) {
      console.error('[notebook] search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}
