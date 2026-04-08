# notebook

A read-only, multi-project markdown viewer with live reload, Mermaid diagrams, frontmatter support, and fast file/content search.

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

1. `./notebook.config.json` in the current working directory
2. `~/.config/notebook/config.json`
3. Or override with `--config <path>`.

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
