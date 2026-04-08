import { File, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/types';

interface Props {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  openDirs: Set<string>;
  tabbablePath: string | null;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onFocusEntry: (path: string) => void;
}

export function FileExplorerNode({
  node,
  depth,
  activeFilePath,
  openDirs,
  tabbablePath,
  onToggleDir,
  onSelectFile,
  onFocusEntry,
}: Props) {
  const indent = depth * 12;
  const path = node.path ?? node.name;
  const isTabbable = path === tabbablePath;

  if (node.type === 'dir') {
    const isOpen = openDirs.has(path);
    return (
      <div>
        <button
          role="treeitem"
          aria-expanded={isOpen}
          data-tree-path={path}
          tabIndex={isTabbable ? 0 : -1}
          className="flex w-full items-center gap-1.5 px-2 py-1 text-sm rounded hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none transition-colors text-left cursor-pointer"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => {
            onFocusEntry(path);
            onToggleDir(path);
          }}
          onFocus={() => onFocusEntry(path)}
        >
          {isOpen ? (
            <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children?.map((child) => (
          <FileExplorerNode
            key={child.path ?? child.name}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            openDirs={openDirs}
            tabbablePath={tabbablePath}
            onToggleDir={onToggleDir}
            onSelectFile={onSelectFile}
            onFocusEntry={onFocusEntry}
          />
        ))}
      </div>
    );
  }

  const isActive = path === activeFilePath;

  return (
    <button
      role="treeitem"
      aria-selected={isActive}
      data-tree-path={path}
      tabIndex={isTabbable ? 0 : -1}
      className={cn(
        'flex w-full items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors text-left focus-visible:outline-none cursor-pointer',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={() => {
        onFocusEntry(path);
        onSelectFile(path);
      }}
      onFocus={() => onFocusEntry(path)}
    >
      <File className="size-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
