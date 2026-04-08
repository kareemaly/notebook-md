import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/types';

interface Props {
  results: SearchResult[];
  loading: boolean;
  activeFilePath: string | null;
  onSelect: (filePath: string) => void;
}

export function SearchResults({ results, loading, activeFilePath, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground italic">No results</p>;
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="py-1 pr-1">
        {results.map((r, i) => {
          const isActive = r.filePath === activeFilePath;
          return (
            <button
              key={`${r.filePath}:${r.line ?? i}`}
              className={cn(
                'flex flex-col w-full text-left px-3 py-1.5 rounded text-xs gap-0.5 transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
              onClick={() => onSelect(r.filePath)}
            >
              <span className="font-medium truncate">{r.filePath}</span>
              {r.snippet && (
                <span className={cn('truncate opacity-70', isActive ? '' : 'text-muted-foreground')}>
                  {r.line != null && <span className="font-mono mr-1">:{r.line}</span>}
                  {r.snippet}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
