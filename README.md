# notebook

A read-only, multi-project markdown viewer with live reload, mermaid diagrams, frontmatter support, and fast file/content search.

> Status: early scaffolding. Not yet usable.

## Features (planned)

- Multi-project: configure any number of project roots; switch between them in the UI
- Markdown rendering with syntax highlighting and Mermaid diagrams
- YAML frontmatter parsed and shown as a metadata panel
- File explorer scoped to the active project
- Search: filename and full-text (ripgrep when available, JS fallback otherwise)
- Copy to clipboard: raw markdown and individual code blocks
- Live reload via filesystem watcher
- Cross-platform: macOS, Linux, Windows
- Read-only by design

## Configuration

Default config location: `~/.config/notebook/config.json`
Override with `--config <path>`.

Example (subject to change):

```json
{
  "port": 9001,
  "projects": [
    { "name": "Docs", "path": "~/work/docs" },
    { "name": "Notes", "path": "~/notes" }
  ]
}
```

## License

MIT
