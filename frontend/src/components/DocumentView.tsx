import { Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FileResponse } from '@/types';
import { EmptyState } from './EmptyState';
import { FrontmatterPanel } from './FrontmatterPanel';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  fileData: FileResponse | null;
  loading: boolean;
  error: string | null;
  filePath: string | null;
}

export function DocumentView({ fileData, loading, error, filePath }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyRaw() {
    if (!fileData) return;
    await navigator.clipboard.writeText(fileData.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!filePath && !loading) return <EmptyState />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!fileData) return null;

  const hasFrontmatter = Object.keys(fileData.frontmatter).length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-xs font-mono text-muted-foreground truncate">{filePath}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs shrink-0 gap-1.5"
            onClick={copyRaw}
            aria-label="Copy raw markdown"
          >
            {copied ? (
              <>
                <Check className="size-3 text-green-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3" /> Copy raw
              </>
            )}
          </Button>
        </div>

        {hasFrontmatter && <FrontmatterPanel data={fileData.frontmatter} />}
        <MarkdownRenderer markdown={fileData.body} />
      </div>
    </ScrollArea>
  );
}
