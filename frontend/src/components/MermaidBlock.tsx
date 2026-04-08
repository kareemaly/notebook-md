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
  });
  lastInitTheme = theme;
}

interface Props {
  value: string;
}

export function MermaidBlock({ value }: Props) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid render failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, value, resolvedTheme]);

  if (error) {
    return (
      <pre className="rounded-md border bg-muted p-4 text-sm text-destructive overflow-x-auto my-4">
        {value}
      </pre>
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
