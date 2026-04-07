import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/types';

interface Props {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  openDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}

export function FileExplorerNode({
  node,
  depth,
  activeFilePath,
  openDirs,
  onToggleDir,
  onSelectFile,
}: Props) {
  const indent = depth * 12;

  if (node.type === 'dir') {
    const dirPath = node.path ?? node.name;
    const isOpen = openDirs.has(dirPath);
    return (
      <div>
        <button
          role="treeitem"
          aria-expanded={isOpen}
          className="flex w-full items-center gap-1.5 px-2 py-1 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => onToggleDir(dirPath)}
        >
          {isOpen ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
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
            onToggleDir={onToggleDir}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  const filePath = node.path ?? node.name;
  const isActive = filePath === activeFilePath;

  return (
    <button
      role="treeitem"
      aria-selected={isActive}
      className={cn(
        'flex w-full items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors text-left',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={() => onSelectFile(filePath)}
    >
      <File className="size-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
