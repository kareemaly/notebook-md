import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SearchMode } from '@/types';

interface Props {
  query: string;
  mode: SearchMode;
  onQueryChange: (q: string) => void;
  onModeChange: (m: SearchMode) => void;
  onClose: () => void;
}

export function SearchBar({ query, mode, onQueryChange, onModeChange, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="flex flex-col gap-2 p-2 border-b" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          className="h-7 text-sm"
          aria-label="Search"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close search">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex gap-1">
        <Button
          variant={mode === 'filename' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => onModeChange('filename')}
        >
          Filename
        </Button>
        <Button
          variant={mode === 'content' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => onModeChange('content')}
        >
          Content
        </Button>
      </div>
    </div>
  );
}
