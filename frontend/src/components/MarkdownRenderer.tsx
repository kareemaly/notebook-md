import { type ComponentProps, lazy, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@/styles/markdown.css';

type RehypePlugins = ComponentProps<typeof ReactMarkdown>['rehypePlugins'];

/**
 * Tiny rehype plugin that wraps every case-insensitive occurrence of
 * `query` inside text nodes with a <mark class="md-hl"> element. Skips
 * the contents of <code> / <pre> so we don't clobber syntax-highlighted
 * source. Written inline to avoid pulling in `unist-util-visit` as a
 * direct dependency.
 */
type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function makeHighlightPlugin(query: string, caseSensitive: boolean) {
  return function rehypeHighlight() {
    return (tree: HastNode) => {
      const q = query.trim();
      if (!q) return;
      const needle = caseSensitive ? q : q.toLowerCase();
      const len = q.length;
      const prep = (s: string) => (caseSensitive ? s : s.toLowerCase());

      function walk(node: HastNode) {
        if (!node || !Array.isArray(node.children)) return;
        // Leave code spans and pre blocks alone — they're rendered by
        // react-syntax-highlighter later and would be mangled anyway.
        if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) {
          return;
        }
        const newChildren: HastNode[] = [];
        for (const child of node.children) {
          if (child.type === 'text' && typeof child.value === 'string') {
            const text = child.value;
            const haystack = prep(text);
            if (!haystack.includes(needle)) {
              newChildren.push(child);
              continue;
            }
            let last = 0;
            let idx = haystack.indexOf(needle);
            while (idx !== -1) {
              if (idx > last) {
                newChildren.push({ type: 'text', value: text.slice(last, idx) });
              }
              newChildren.push({
                type: 'element',
                tagName: 'mark',
                properties: { className: ['md-hl'] },
                children: [{ type: 'text', value: text.slice(idx, idx + len) }],
              });
              last = idx + len;
              idx = haystack.indexOf(needle, last);
            }
            if (last < text.length) {
              newChildren.push({ type: 'text', value: text.slice(last) });
            }
          } else {
            walk(child);
            newChildren.push(child);
          }
        }
        node.children = newChildren;
      }
      walk(tree);
    };
  };
}

// Heavy renderers are lazy-loaded. Mermaid (~700KB) only loads when a
// diagram appears. CodeBlock (react-syntax-highlighter, ~680KB) only loads
// when the first code block renders — unstyled <pre> shown as fallback.
const CodeBlock = lazy(() =>
  import('./CodeBlock').then((m) => ({ default: m.CodeBlock })),
);

const MermaidBlock = lazy(() =>
  import('./MermaidBlock').then((m) => ({ default: m.MermaidBlock })),
);

function PlainCodeFallback({ value }: { value: string }) {
  return (
    <pre className="rounded-md border bg-muted/40 p-4 text-[0.8125rem] leading-[1.5] font-mono overflow-x-auto my-4">
      <code>{value}</code>
    </pre>
  );
}

function MermaidFallback({ value }: { value: string }) {
  return (
    <pre className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground overflow-x-auto my-4">
      Loading diagram…
      {'\n'}
      {value}
    </pre>
  );
}

const ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.pdf']);

function resolveAssetSrc(projectId: string, filePath: string, src: string): string {
  if (/^(https?:|data:|\/\/)/i.test(src)) return src;
  try {
    const base = new URL(`http://x/${filePath}`);
    const resolved = new URL(src, base);
    const assetPath = resolved.pathname.slice(1);
    return `/api/projects/${encodeURIComponent(projectId)}/asset?path=${encodeURIComponent(assetPath)}`;
  } catch {
    return src;
  }
}

function isAssetHref(href: string): boolean {
  const clean = href.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return false;
  return ASSET_EXTS.has(clean.slice(dot).toLowerCase());
}

interface Props {
  markdown: string;
  highlight?: string;
  highlightCaseSensitive?: boolean;
  projectId?: string;
  filePath?: string;
}

export function MarkdownRenderer({
  markdown,
  highlight,
  highlightCaseSensitive = false,
  projectId,
  filePath,
}: Props) {
  // Memoize so the plugin identity only changes when the query does —
  // otherwise react-markdown re-parses on every render.
  const rehypePlugins = useMemo<RehypePlugins>(() => {
    const q = (highlight ?? '').trim();
    if (!q) return [];
    return [makeHighlightPlugin(q, highlightCaseSensitive)];
  }, [highlight, highlightCaseSensitive]);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          // Strip the default <pre> wrapper — CodeBlock provides its own.
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const value = String(children).replace(/\n$/, '');
            const langMatch = /language-(\w+)/.exec(className ?? '');

            // Inline code: rendered without a language class
            if (!langMatch && !value.includes('\n')) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            const lang = langMatch?.[1] ?? '';

            if (lang === 'mermaid') {
              return (
                <Suspense fallback={<MermaidFallback value={value} />}>
                  <MermaidBlock value={value} />
                </Suspense>
              );
            }

            return (
              <Suspense fallback={<PlainCodeFallback value={value} />}>
                <CodeBlock language={lang} value={value} />
              </Suspense>
            );
          },
          img({ src, alt, ...props }) {
            const resolvedSrc =
              src && projectId && filePath
                ? resolveAssetSrc(projectId, filePath, src)
                : (src ?? '');
            return <img src={resolvedSrc} alt={alt ?? ''} {...props} />;
          },
          a({ href, children, ...props }) {
            if (
              href &&
              !(/^(https?:|data:|\/\/)/i.test(href)) &&
              isAssetHref(href) &&
              projectId &&
              filePath
            ) {
              return <a href={resolveAssetSrc(projectId, filePath, href)} {...props}>{children}</a>;
            }
            return <a href={href} {...props}>{children}</a>;
          },
          // Wrap tables in a horizontally scrollable container
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
