import type { Router } from 'express';
import { Router as createRouter } from 'express';
import type { ConfigRef } from '../../types/index.js';

export function projectsRouter(configRef: ConfigRef): Router {
  const router = createRouter();

  // GET /api/projects — list configured projects (never leaks fs paths)
  router.get('/', (_req, res) => {
    const projects = configRef.current.projects.map((p) => ({ id: p.id, name: p.name }));
    res.json(projects);
  });

  return router;
}
