import type { Router } from 'express';
import { Router as createRouter } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigRef } from '../../types/index.js';
import { resolveSafeAssetPath } from '../pathUtils.js';

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.avif': 'image/avif',
  '.pdf':  'application/pdf',
};

export function assetRouter(configRef: ConfigRef): Router {
  const router = createRouter();

  // GET /api/projects/:id/asset?path=...
  router.get('/:id/asset', (req, res) => {
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

    const resolved = resolveSafeAssetPath(project.path, rawPath);
    if (!resolved) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';

    fs.stat(resolved, (statErr, stat) => {
      if (statErr) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(resolved).pipe(res);
    });
  });

  return router;
}
