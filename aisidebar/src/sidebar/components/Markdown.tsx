import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { codeToHtml } from 'shiki';
import { download } from '../../utils';

const CodeBlock = ({ code, language }: { code: string; language: string }) => {
  const [html, setHtml] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void codeToHtml(code, { lang: language || 'text', theme: 'github-dark-default' }).then((value) => active && setHtml(value)).catch(() => active && setHtml(`<pre><code>${code.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</code></pre>`));
    return () => { active = false; };
  }, [code, language]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className={`code-block ${expanded ? 'expanded' : ''}`}>
      <header>
        <span>{language || 'text'}</span>
        <div>
          <button type="button" aria-label={expanded ? 'Collapse code' : 'Expand code'} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown /> : <ChevronUp />}</button>
          <button type="button" aria-label="Download code" onClick={() => download(`snippet.${language || 'txt'}`, code, 'text/plain')}><Download /></button>
          <button type="button" aria-label="Copy code" onClick={copy}>{copied ? <Check /> : <Copy />}</button>
        </div>
      </header>
      <div className="highlight" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
};

export const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      a: ({ children: label, ...props }) => <a {...props} target="_blank" rel="noreferrer">{label}</a>,
      pre: ({ children: code }) => <>{code}</>,
      code: ({ className, children: code }) => {
        const language = /language-(\w+)/.exec(className ?? '')?.[1];
        const value = String(code).replace(/\n$/, '');
        return language ? <CodeBlock code={value} language={language} /> : <code className={className}>{code}</code>;
      },
    }}
  >
    {children}
  </ReactMarkdown>
);
