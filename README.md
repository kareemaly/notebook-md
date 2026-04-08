# notebook-md

A read-only, multi-project markdown viewer with live reload, Mermaid diagrams, frontmatter support, and fast file/content search.

## Quickstart

Try it in 5 seconds — no config file needed:

```sh
npx notebook-md ~/your-notes
```

This boots an ephemeral session against that path. Nothing is written to disk.

### Keep it

```sh
npm i -g notebook-md

notebook add ~/notes
notebook add ~/work/docs --name "Work Docs"
notebook serve
```

Then open [http://localhost:9001](http://localhost:9001).

## CLI reference

```
notebook serve [--config <path>]          # long-running server (default behavior)
notebook add <path> [--name <name>]       # append a project to the config file
notebook remove <name|index>              # remove a project from the config file
notebook list                             # print configured projects
notebook <path>                           # ephemeral single-project session, no config read/write
notebook                                  # alias for `notebook serve`
```

## Features

- **Multi-project**: configure any number of project roots and switch between them in the UI.
- **Per-project include / exclude**: restrict a project to specific top-level folders without moving files.
- **Markdown rendering** with GFM, syntax-highlighted code blocks, and Mermaid diagrams (both lazy-loaded so the initial bundle stays small).
- **YAML frontmatter** parsed and shown as a collapsible metadata panel.
- **File explorer** with keyboard navigation (↑/↓/←/→, Enter, Home/End) and auto-reveal of the active file on page load.
- **Search** — filename and full-text, powered by ripgrep when available with a pure-JS fallback. Toggleable case sensitivity. Matches in the opened document body are highlighted live.
- **URL state**: the active project and file are tracked in the query string, so a refresh or bookmark restores the exact view. Back/forward navigates between documents.
- **Dark mode** with a sun/moon toggle; follows `prefers-color-scheme` by default.
- **Resizable sidebar** (drag the right edge, double-click to reset; Arrow keys when focused).
- **Copy to clipboard** for raw markdown and individual code blocks.
- **Live reload** via a filesystem watcher — edits outside the app refresh the open document.
- **Config hot-reload** — edit the config file while the server is running; the project list updates without a restart.
- **Cross-platform**: macOS, Linux, Windows.
- **Read-only by design** — notebook never modifies project files.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Search filenames |
| `⌘⇧K` / `Ctrl+Shift+K` | Search file content |
| `Esc` | Close mobile drawer / search |
| `↑` `↓` | Move selection in the file tree |
| `→` `←` | Expand / collapse directory |
| `Enter` | Open file / toggle directory |
| `Home` `End` | Jump to first / last entry |

## Configuration

Config discovery order:

1. `--config <path>` if passed to `notebook serve`
2. `./notebook.config.json` in the current working directory
3. `~/.config/notebook/config.json`
4. Built-in defaults (empty project list, port 9001)

`notebook add` creates `~/.config/notebook/config.json` if no config file exists, or appends to whichever file would be loaded above.

### Example

```json
{
  "port": 9001,
  "projects": [
    {
      "name": "Work Docs",
      "path": "~/work/docs",
      "include": ["guides", "runbooks", "architecture"],
      "exclude": ["guides/drafts"]
    },
    {
      "name": "Personal Notes",
      "path": "~/notes"
    }
  ],
  "watcher": {
    "usePolling": false
  }
}
```

### Project fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Display name shown in the project switcher. |
| `path` | string | Absolute or `~`-prefixed path to the project root. |
| `include` | `string[]` (optional) | Path prefixes (relative, POSIX separators) to expose. If set, only files whose relative path is at or under one of these prefixes are shown. |
| `exclude` | `string[]` (optional) | Path prefixes to hide. Exclude beats include. |

Supported file formats are tracked in `src/supportedFormats.ts`. Today that is just `.md`.

## License

MIT
