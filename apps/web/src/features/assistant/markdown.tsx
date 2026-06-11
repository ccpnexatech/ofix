import type { ReactNode } from 'react';

/** Minimal markdown for chat bubbles: paragraphs, **bold**, `code`, - lists. */
export function renderMarkdown(text: string): ReactNode[] {
  const inline = (line: string, key: number): ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-surface-sunken px-1 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
    return <span key={key}>{parts}</span>;
  };

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="my-1 list-disc pl-4">
          {list.map((item, i) => (
            <li key={i}>{inline(item, i)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (trimmed !== '') {
      blocks.push(
        <p key={blocks.length} className="my-1">
          {inline(trimmed, 0)}
        </p>,
      );
    }
  }
  flushList();
  return blocks;
}
