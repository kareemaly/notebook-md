import mermaid from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

// Mermaid's `initialize` is global state. Track the last theme we
// configured so a page with many diagrams only re-initializes once per
// theme change rather than once per diagram render.
let lastInitTheme: 'light' | 'dark' | null = null;
function ensureMermaidTheme(theme: 'light' | 'dark') {
  if (lastInitTheme === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'neutral',
    suppressErrorRendering: true,
  });
  lastInitTheme = theme;
}

interface Props {
  value: string;
}

interface MermaidError {
  message: string;
  detail?: string;
}

export function MermaidBlock({ value }: Props) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<MermaidError | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    ensureMermaidTheme(resolvedTheme);

    mermaid
      .render(`mermaid-${id}-${resolvedTheme}`, value)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        let message = 'Mermaid render failed';
        let detail: string | undefined;

        if (err && typeof err === 'object') {
          if ('str' in err && typeof (err as any).str === 'string') {
            message = (err as any).str;
            const hash = (err as any).hash;
            if (hash && typeof hash === 'object') {
              const loc = hash.loc ?? hash;
              const line = loc.first_line ?? loc.line;
              if (typeof line === 'number') detail = `Line ${line}`;
            }
          } else if (err instanceof Error) {
            message = err.message;
          }
        }

        setError({ message, detail });
      });

    return () => {
      cancelled = true;
    };
  }, [id, value, resolvedTheme]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-muted my-4 overflow-x-auto text-sm">
        <div className="flex items-start gap-2 px-4 py-2 text-destructive border-b border-destructive/30">
          <span className="font-semibold shrink-0">Mermaid error</span>
          {error.detail && (
            <span className="text-destructive/70 shrink-0">({error.detail})</span>
          )}
          <span className="break-all">{error.message}</span>
        </div>
        <pre className="p-4 text-muted-foreground">{value}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto"
      aria-label="Mermaid diagram"
    />
  );
}
