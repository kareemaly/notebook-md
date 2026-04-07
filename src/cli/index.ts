import { Command } from 'commander';
import http from 'node:http';
import { ZodError, loadConfig } from '../config/index.js';
import { createApp } from '../server/app.js';
import { attachWebSocket } from '../server/ws.js';

const program = new Command();

program
  .name('notebook')
  .description('Read-only multi-project markdown viewer')
  .version('0.1.0')
  .option('--config <path>', 'Path to config file')
  .parse();

const opts = program.opts<{ config?: string }>();

try {
  const config = await loadConfig(opts.config);
  const app = createApp(config);
  const server = http.createServer(app);

  attachWebSocket(server, config);

  server.listen(config.port, () => {
    console.log(`\nnotebook running at http://localhost:${config.port}`);
    console.log(`WebSocket live-reload at ws://localhost:${config.port}/ws`);
    console.log(`\nProjects loaded (${config.projects.length}):`);
    for (const p of config.projects) {
      console.log(`  [${p.id}] ${p.name}  →  ${p.path}`);
    }
    if (config.projects.length === 0) {
      console.log(
        '  (none configured — add projects to notebook.config.json or ~/.config/notebook/config.json)',
      );
    }
    console.log('');
  });
} catch (err) {
  if (err instanceof ZodError) {
    console.error('Config validation failed:');
    for (const issue of err.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
  } else if (err instanceof Error) {
    console.error('Failed to start notebook:', err.message);
  } else {
    console.error('Failed to start notebook:', err);
  }
  process.exit(1);
}
