import { Command } from 'commander';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  XDG_CONFIG_PATH,
  ZodError,
  expandTilde,
  loadConfig,
  readRawConfig,
  writeRawConfig,
} from '../config/index.js';
import { createApp } from '../server/app.js';
import { attachWebSocket } from '../server/ws.js';
import type { ConfigRef, NotebookConfig } from '../types/index.js';

// ---------------------------------------------------------------------------
// Shared server startup helpers
// ---------------------------------------------------------------------------

async function runServe(opts: { config?: string }): Promise<void> {
  const { config, configFilePath } = await loadConfig(opts.config);
  const configRef: ConfigRef = { current: config };

  const app = createApp(configRef);
  const server = http.createServer(app);

  const { watcherManager } = attachWebSocket(
    server,
    configRef,
    configFilePath,
    (newConfig: NotebookConfig) => {
      const activeId = watcherManager.getActiveProjectId();
      configRef.current = newConfig;
      if (activeId && !newConfig.projects.find((p) => p.id === activeId)) {
        // Active project was removed or its path changed — deactivate watcher.
        // The frontend will detect the stale project and re-select.
        watcherManager.deactivate();
      }
    },
  );

  server.listen(config.port, () => {
    console.log(`\nnotebook running at http://localhost:${config.port}`);
    console.log(`WebSocket live-reload at ws://localhost:${config.port}/ws`);
    console.log(`\nProjects loaded (${config.projects.length}):`);
    for (const p of config.projects) {
      console.log(`  [${p.id}] ${p.name}  →  ${p.path}`);
    }
    if (config.projects.length === 0) {
      console.log(
        '  (none configured — use `notebook add <path>` or edit the config file directly)',
      );
    }
    console.log('');
  });
}

async function runEphemeral(rawPath: string): Promise<void> {
  const resolvedPath = path.resolve(expandTilde(rawPath));
  const ephemeralConfig: NotebookConfig = {
    port: 9001,
    projects: [{ id: '0', name: path.basename(resolvedPath), path: resolvedPath }],
    watcher: { usePolling: false },
  };
  const configRef: ConfigRef = { current: ephemeralConfig };

  const app = createApp(configRef);
  const server = http.createServer(app);

  // configFilePath=null → no config file watching
  attachWebSocket(server, configRef, null, () => {});

  server.listen(ephemeralConfig.port, () => {
    console.log(`\nnotebook running at http://localhost:${ephemeralConfig.port}`);
    console.log(`WebSocket live-reload at ws://localhost:${ephemeralConfig.port}/ws`);
    console.log(`\nProject: ${ephemeralConfig.projects[0].name}  →  ${resolvedPath}`);
    console.log('(ephemeral session — no config file read or written)\n');
  });
}

// ---------------------------------------------------------------------------
// Error handler wrapper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapErrors<T extends (...args: any[]) => Promise<void>>(fn: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        console.error('Config validation failed:');
        for (const issue of err.issues) {
          console.error(`  ${issue.path.join('.')}: ${issue.message}`);
        }
      } else if (err instanceof Error) {
        console.error('Error:', err.message);
      } else {
        console.error('Error:', err);
      }
      process.exit(1);
    }
  };
  return wrapped as T;
}

// ---------------------------------------------------------------------------
// Subcommand builders
// ---------------------------------------------------------------------------

function buildServeCommand(): Command {
  return new Command('serve')
    .description('Start the notebook server (default behavior)')
    .option('--config <path>', 'Path to config file')
    .action(
      wrapErrors(async function (this: Command) {
        const opts = this.opts<{ config?: string }>();
        await runServe(opts);
      }),
    );
}

function buildAddCommand(): Command {
  return new Command('add')
    .description('Append a project to the config file')
    .argument('<path>', 'Path to the project directory')
    .option('--name <name>', 'Display name for the project')
    .action(
      wrapErrors(async function (this: Command, rawPath: string) {
        const opts = this.opts<{ name?: string }>();
        const resolved = path.resolve(expandTilde(rawPath));
        const name = opts.name ?? path.basename(resolved);

        // Discover existing config file (or fall back to XDG)
        const { configFilePath } = await loadConfig();
        const targetPath = configFilePath ?? XDG_CONFIG_PATH;

        let rawJson: Record<string, unknown> = {};
        if (fs.existsSync(targetPath)) {
          rawJson = readRawConfig(targetPath) as Record<string, unknown>;
        }

        const projects: unknown[] = Array.isArray(rawJson.projects) ? rawJson.projects : [];
        // Store original user path (tilde expansion happens at load time)
        projects.push({ name, path: rawPath });

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        writeRawConfig(targetPath, { ...rawJson, projects });

        console.log(`Added "${name}"  →  ${resolved}`);
        console.log(`Config: ${targetPath}`);
      }),
    );
}

function buildRemoveCommand(): Command {
  return new Command('remove')
    .description('Remove a project from the config file by name or index')
    .argument('<name|index>', 'Project name or numeric index (from `notebook list`)')
    .action(
      wrapErrors(async function (nameOrIndex: string) {
        const { configFilePath } = await loadConfig();
        if (!configFilePath) {
          console.error('No config file found. Nothing to remove.');
          process.exit(1);
        }

        const rawJson = readRawConfig(configFilePath) as Record<string, unknown>;
        const projects: unknown[] = Array.isArray(rawJson.projects) ? rawJson.projects : [];

        const isIndex = /^\d+$/.test(nameOrIndex);
        let removeIdx = -1;

        if (isIndex) {
          const idx = parseInt(nameOrIndex, 10);
          if (idx < projects.length) removeIdx = idx;
        } else {
          removeIdx = projects.findIndex(
            (p) =>
              typeof p === 'object' &&
              p !== null &&
              (p as Record<string, unknown>).name === nameOrIndex,
          );
        }

        if (removeIdx === -1) {
          console.error(`Project "${nameOrIndex}" not found.`);
          process.exit(1);
        }

        const removed = projects[removeIdx] as Record<string, unknown>;
        projects.splice(removeIdx, 1);
        writeRawConfig(configFilePath, { ...rawJson, projects });

        console.log(`Removed "${String(removed.name ?? nameOrIndex)}"`);
      }),
    );
}

function buildListCommand(): Command {
  return new Command('list')
    .description('Print configured projects')
    .action(
      wrapErrors(async () => {
        const { config } = await loadConfig();
        if (config.projects.length === 0) {
          console.log('No projects configured.');
          return;
        }
        for (const p of config.projects) {
          console.log(`  [${p.id}] ${p.name}  ${p.path}`);
        }
      }),
    );
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('notebook')
  .description('Read-only multi-project markdown viewer')
  .version('0.1.0')
  .addCommand(buildServeCommand())
  .addCommand(buildAddCommand())
  .addCommand(buildRemoveCommand())
  .addCommand(buildListCommand())
  // Positional shortcut: `notebook <path>` → ephemeral session
  // No args → backward-compat serve with hint
  .argument('[path]', 'Path for an ephemeral single-project session')
  .action(
    wrapErrors(async (posPath: string | undefined) => {
      if (posPath) {
        await runEphemeral(posPath);
      } else {
        console.log(
          'Tip: use `notebook serve` to start, or `notebook <path>` for a quick session.',
        );
        await runServe({ config: undefined });
      }
    }),
  );

program.parseAsync();
