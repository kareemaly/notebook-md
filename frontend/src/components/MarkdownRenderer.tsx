import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@/styles/markdown.css';
import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';

interface Props {
  markdown: string;
}

export function MarkdownRenderer({ markdown }: Props) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
              return <MermaidBlock value={value} />;
            }

            return <CodeBlock language={lang} value={value} />;
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
