import mermaid from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';

mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

interface Props {
  value: string;
}

export function MermaidBlock({ value }: Props) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    mermaid
      .render(`mermaid-${id}`, value)
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
  }, [id, value]);

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
