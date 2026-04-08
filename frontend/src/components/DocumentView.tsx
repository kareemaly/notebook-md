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
  highlight?: string;
  highlightCaseSensitive?: boolean;
}

export function DocumentView({
  fileData,
  loading,
  error,
  filePath,
  highlight,
  highlightCaseSensitive,
}: Props) {
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
    <div className="relative h-full">
      <ScrollArea className="h-full">
        <div className="max-w-3xl mx-auto px-8 pt-4 pb-8">
          {hasFrontmatter && <FrontmatterPanel data={fileData.frontmatter} />}
          <MarkdownRenderer
            markdown={fileData.body}
            highlight={highlight}
            highlightCaseSensitive={highlightCaseSensitive}
          />
        </div>
      </ScrollArea>

      {/* Floating copy-raw button — pinned to the top-right of the
          document viewport, above the scrolling content. */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-4 z-10 h-8 w-8 bg-background/80 backdrop-blur border shadow-sm hover:bg-background"
        onClick={copyRaw}
        aria-label={copied ? 'Copied raw markdown' : 'Copy raw markdown'}
        title={copied ? 'Copied' : 'Copy raw markdown'}
      >
        {copied ? (
          <Check className="size-3.5 text-green-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
