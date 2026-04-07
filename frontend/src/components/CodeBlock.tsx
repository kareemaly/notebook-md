import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';

interface Props {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative group my-4 rounded-md border bg-[#fafafa] overflow-hidden">
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.8125rem',
          lineHeight: '1.5',
        }}
        codeTagProps={{
          style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
        }}
      >
        {value}
      </SyntaxHighlighter>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur border"
        onClick={copy}
        aria-label="Copy code"
      >
        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      </Button>

      {language && (
        <span className="absolute bottom-1.5 right-2 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {language}
        </span>
      )}
    </div>
  );
}
