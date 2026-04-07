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

  return app;
}
