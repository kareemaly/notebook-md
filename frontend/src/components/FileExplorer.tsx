import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileExplorerNode } from './FileExplorerNode';
import type { FileNode } from '@/types';

interface Props {
  tree: FileNode[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
}

interface FlatEntry {
  node: FileNode;
  path: string;
  depth: number;
  parentPath: string | null;
}

/**
 * Flatten the visible portion of the tree (respecting which directories are
 * currently open) so arrow-key navigation has a simple linear model.
 */
function flattenVisible(
  nodes: FileNode[],
  openDirs: Set<string>,
  depth = 0,
  parentPath: string | null = null,
  out: FlatEntry[] = [],
): FlatEntry[] {
  for (const node of nodes) {
    const path = node.path ?? node.name;
    out.push({ node, path, depth, parentPath });
    if (node.type === 'dir' && openDirs.has(path) && node.children) {
      flattenVisible(node.children, openDirs, depth + 1, path, out);
    }
  }
  return out;
}

/** All ancestor directory paths of a file, e.g. "a/b/c.md" → ["a", "a/b"]. */
function ancestorsOf(filePath: string): string[] {
  const parts = filePath.split('/');
  if (parts.length <= 1) return [];
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    out.push(parts.slice(0, i).join('/'));
  }
  return out;
}

export function FileExplorer({ tree, activeFilePath, onSelectFile }: Props) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRevealedRef = useRef<string | null>(null);

  const flat = useMemo(() => flattenVisible(tree, openDirs), [tree, openDirs]);

  // Keep focus on a valid entry if the tree or open-state changes.
  useEffect(() => {
    if (focusedPath && !flat.some((e) => e.path === focusedPath)) {
      setFocusedPath(flat[0]?.path ?? null);
    }
  }, [flat, focusedPath]);

  // When the active file changes (e.g. on page load from a URL, or from
  // a search result click), expand its ancestor directories and scroll
  // it into view. Only runs once per distinct activeFilePath so the user
  // can collapse a dir after opening a file without it snapping back.
  useEffect(() => {
    if (!activeFilePath || tree.length === 0) return;
    if (lastRevealedRef.current === activeFilePath) return;
    lastRevealedRef.current = activeFilePath;

    const ancestors = ancestorsOf(activeFilePath);
    if (ancestors.length > 0) {
      setOpenDirs((prev) => {
        const next = new Set(prev);
        for (const a of ancestors) next.add(a);
        return next;
      });
    }

    // Wait two frames: one for setOpenDirs to commit, one for layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector<HTMLButtonElement>(
          `[data-tree-path="${CSS.escape(activeFilePath)}"]`,
        );
        el?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      });
    });
  }, [activeFilePath, tree]);

  const toggleDir = useCallback((path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const focusEntry = useCallback((path: string) => {
    setFocusedPath(path);
    // Focus the matching button so screen readers announce it.
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-tree-path="${CSS.escape(path)}"]`,
      );
      el?.focus();
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (flat.length === 0) return;
      const currentPath = focusedPath ?? activeFilePath ?? flat[0].path;
      const index = flat.findIndex((entry) => entry.path === currentPath);
      if (index === -1) return;
      const current = flat[index];

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = flat[Math.min(flat.length - 1, index + 1)];
          if (next) focusEntry(next.path);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = flat[Math.max(0, index - 1)];
          if (prev) focusEntry(prev.path);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (current.node.type === 'dir') {
            if (!openDirs.has(current.path)) toggleDir(current.path);
            else {
              const next = flat[index + 1];
              if (next && next.depth > current.depth) focusEntry(next.path);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (current.node.type === 'dir' && openDirs.has(current.path)) {
            toggleDir(current.path);
          } else if (current.parentPath) {
            focusEntry(current.parentPath);
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (current.node.type === 'dir') toggleDir(current.path);
          else onSelectFile(current.path);
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusEntry(flat[0].path);
          break;
        }
        case 'End': {
          e.preventDefault();
          focusEntry(flat[flat.length - 1].path);
          break;
        }
      }
    },
    [flat, focusedPath, activeFilePath, openDirs, toggleDir, onSelectFile, focusEntry],
  );

  if (tree.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground italic">No files found</p>
    );
  }

  const tabbablePath = focusedPath ?? activeFilePath ?? flat[0]?.path ?? null;

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div
        ref={containerRef}
        role="tree"
        aria-label="File tree"
        className="py-1 pr-1"
        onKeyDown={handleKeyDown}
      >
        {tree.map((node) => (
          <FileExplorerNode
            key={node.path ?? node.name}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            openDirs={openDirs}
            tabbablePath={tabbablePath}
            onToggleDir={toggleDir}
            onSelectFile={onSelectFile}
            onFocusEntry={setFocusedPath}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
