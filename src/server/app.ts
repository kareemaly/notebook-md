import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import type { NotebookConfig } from '../types/index.js';
import { fileRouter } from './routes/file.js';
import { projectsRouter } from './routes/projects.js';
import { searchRouter } from './routes/search.js';
import { treeRouter } from './routes/tree.js';

export function createApp(config: NotebookConfig): express.Application {
  const app = express();

  app.use(express.json());

  // Project list
  app.use('/api/projects', projectsRouter(config));

  // Per-project routes — all share the /:id prefix
  app.use('/api/projects', treeRouter(config));
  app.use('/api/projects', fileRouter(config));
  app.use('/api/projects', searchRouter(config));

  // Static SPA — served after all API routes so /api/* is never shadowed.
  // import.meta.dirname is not available in Node 18, so we use fileURLToPath.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.join(__dirname, '..', '..', 'client');

  // Hashed assets get long-lived cache headers
  app.use(
    '/assets',
    express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }),
  );
  // Other static files (favicon, etc.)
  app.use(express.static(clientDist, { index: false }));
  // SPA fallback: all non-API GET requests serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
