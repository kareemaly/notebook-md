import { CaseSensitive, FileText, TextSearch, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SearchMode } from '@/types';

interface Props {
  query: string;
  mode: SearchMode;
  caseSensitive: boolean;
  onQueryChange: (q: string) => void;
  onModeChange: (m: SearchMode) => void;
  onToggleCaseSensitive: () => void;
  onClose: () => void;
}

export function SearchBar({
  query,
  mode,
  caseSensitive,
  onQueryChange,
  onModeChange,
  onToggleCaseSensitive,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the input when the mode changes, but only if focus isn't
  // already on one of our own controls — otherwise keyboard users who
  // tabbed to a mode button would be yanked back to the input.
  useEffect(() => {
    const active = document.activeElement;
    if (active && containerRef.current?.contains(active) && active !== inputRef.current) {
      return;
    }
    inputRef.current?.focus();
  }, [mode]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const modeButton = (target: SearchMode, label: string, Icon: typeof FileText) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-7 w-7 shrink-0',
        mode === target
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
          : 'text-muted-foreground',
      )}
      onClick={() => onModeChange(target)}
      aria-label={label}
      aria-pressed={mode === target}
      title={label}
    >
      <Icon className="size-3.5" />
    </Button>
  );

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1 p-2 border-b"
      onKeyDown={handleKeyDown}
    >
      {modeButton('filename', 'Filename search (⌘K)', FileText)}
      {modeButton('content', 'Content search (⌘⇧K)', TextSearch)}
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={mode === 'filename' ? 'Filename…' : 'Content…'}
        className="h-7 text-sm min-w-0 flex-1 pl-2.5 focus-visible:ring-1 focus-visible:ring-offset-0"
        aria-label={mode === 'filename' ? 'Search filenames' : 'Search content'}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 shrink-0',
          caseSensitive
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            : 'text-muted-foreground',
        )}
        onClick={onToggleCaseSensitive}
        aria-label="Toggle case-sensitive search"
        aria-pressed={caseSensitive}
        title={caseSensitive ? 'Case sensitive' : 'Case insensitive'}
      >
        <CaseSensitive className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onClose}
        aria-label="Close search"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
