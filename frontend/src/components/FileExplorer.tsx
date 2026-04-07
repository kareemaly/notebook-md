import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileExplorerNode } from './FileExplorerNode';
import type { FileNode } from '@/types';

interface Props {
  tree: FileNode[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
}

export function FileExplorer({ tree, activeFilePath, onSelectFile }: Props) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());

  function toggleDir(path: string) {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  if (tree.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground italic">No files found</p>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div role="tree" className="py-1 pr-1">
        {tree.map((node) => (
          <FileExplorerNode
            key={node.path ?? node.name}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            openDirs={openDirs}
            onToggleDir={toggleDir}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
