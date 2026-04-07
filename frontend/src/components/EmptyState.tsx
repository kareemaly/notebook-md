import { BookOpen } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
      <BookOpen className="size-10 opacity-30" />
      <p className="text-sm">Select a file from the explorer</p>
    </div>
  );
}
