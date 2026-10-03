import { Fragment } from 'react';
import { isOfficialUrl } from '../lib/domains.ts';

type Block =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ol' | 'ul'; items: string[] };

function blocks(src: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (!line) flush();
    else if (h) {
      flush();
      out.push({ type: 'h', text: h[1].replace(/\*\*/g, '') });
    } else if (ol || ul) {
      flush();
      const type = ol ? 'ol' : 'ul';
      const last = out.at(-1);
      const text = (ol ?? ul)![1];
      if (last && last.type === type) last.items.push(text);
      else out.push({ type, items: [text] });
    } else para.push(line);
  }
  flush();
  return out;
}

function Inline({ text, anchor }: { text: string; anchor: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d{1,2}\]|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        const bold = p.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold text-ink">{bold[1]}</strong>;
        const code = p.match(/^`([^`]+)`$/);
        if (code) return <span key={i} className="font-medium text-ink">{code[1]}</span>;
        const cite = p.match(/^\[(\d{1,2})\]$/);
        if (cite) {
          return (
            <a
              key={i}
              href={`#${anchor}-${cite[1]}`}
              className="mx-0.5 inline-grid min-w-5 place-items-center rounded-md bg-brand-wash px-1 align-[0.12em] text-[0.7rem] font-bold leading-5 text-brand-deep no-underline transition-colors hover:bg-brand hover:text-brand-ink"
              aria-label={`Source ${cite[1]}`}
            >
              {cite[1]}
            </a>
          );
        }
        const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          return isOfficialUrl(link[2]) ? (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">
              {link[1]}
            </a>
          ) : (
            <Fragment key={i}>{link[1]}</Fragment>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Minimal, React-only markdown: headings, lists, paragraphs, bold, [n] citations. No raw HTML. */
export function Markdown({ text, anchor, streaming = false }: { text: string; anchor: string; streaming?: boolean }) {
  const bs = blocks(text);
  return (
    <div className={`space-y-3 text-[1.02rem] leading-relaxed text-ink-soft ${streaming ? '[&>*:last-child]:caret' : ''}`}>
      {bs.map((b, i) => {
        if (b.type === 'h') {
          return (
            <h4 key={i} className="pt-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-deep">
              {b.text}
            </h4>
          );
        }
        if (b.type === 'p') {
          return (
            <p key={i} className={i === 0 ? 'text-[1.08rem] text-ink' : ''}>
              <Inline text={b.text} anchor={anchor} />
            </p>
          );
        }
        const List = b.type === 'ol' ? 'ol' : 'ul';
        return (
          <List key={i} className="space-y-2">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-3">
                <span
                  className={
                    b.type === 'ol'
                      ? 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink'
                      : 'mt-2.5 size-1.5 shrink-0 rounded-full bg-brand'
                  }
                  aria-hidden
                >
                  {b.type === 'ol' ? j + 1 : null}
                </span>
                <span className="min-w-0">
                  <Inline text={it} anchor={anchor} />
                </span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
