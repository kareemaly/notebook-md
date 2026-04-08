import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

interface Props {
  data: Record<string, unknown>;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function FrontmatterPanel({ data }: Props) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <Collapsible defaultOpen className="mb-4">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 group cursor-pointer">
        <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
        Frontmatter
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border bg-muted/50 p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {entries.map(([key, value]) => (
              <>
                <dt key={`k-${key}`} className="font-mono text-muted-foreground truncate">{key}</dt>
                <dd key={`v-${key}`} className="font-mono break-all">{renderValue(value)}</dd>
              </>
            ))}
          </dl>
        </div>
        <Separator className="mt-4" />
      </CollapsibleContent>
    </Collapsible>
  );
}
